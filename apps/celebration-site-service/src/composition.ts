import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { JsonLogger } from '@rsvp/platform-telemetry';
import type { ApplicationDeps } from './application/command/command-runner.js';
import type { EventHistory, PublicCelebrationStore, PublicStoreTransaction, UnitOfWork } from './application/ports.js';
import type { EventTypeDefinition } from './domain/model/event-type-definition.js';
import { httpJwks, jwtAuthenticator, type Authenticator } from './infrastructure/auth/jwt-authenticator.js';
import { AmqpBroker, InProcessBus } from './infrastructure/messaging/amqp.js';
import { createPgOutboxRelay, startRelayLoop, type RelayLoop } from './infrastructure/messaging/outbox-relay.js';
import { readSeeds, seedEventTypes } from './infrastructure/persistence/event-type-seeds.js';
import { MemoryDatabase } from './infrastructure/persistence/memory/memory-store.js';
import { migrateUp } from './infrastructure/persistence/postgres/migrator.js';
import { createPool, type Pool } from './infrastructure/persistence/postgres/pg-database.js';
import { PgEventHistory, PgPublicStore, PgPublicTransactions } from './infrastructure/persistence/postgres/pg-projection.js';
import { PgUnitOfWork } from './infrastructure/persistence/postgres/pg-unit-of-work.js';
import { PublicCelebrationProjector, PROJECTED_EVENT_TYPES } from './infrastructure/projection/public-celebration-projector.js';
import { consumerSpecs, templateCatalogHandler, TemplateEventType } from './interface/consumer/consumers.js';
import { createHttpServer, type HttpLogger } from './interface/rest/http-server.js';

export interface RuntimeConfig {
  readonly databaseUrl?: string;
  readonly rabbitmqUrl?: string;
  readonly jwksUrl?: string;
  /** Overrides JWKS authentication (tests inject an in-memory key set). */
  readonly authenticator?: Authenticator;
  readonly autoMigrate?: boolean;
  /** Event types to seed; defaults to every file in db/seeds/event-types. */
  readonly seeds?: readonly EventTypeDefinition[];
  readonly relayIntervalMs?: number;
  /** Prefix of the RabbitMQ queues this instance consumes from (CELEBRATION_QUEUE_PREFIX). */
  readonly queuePrefix?: string;
  /** Exclusive auto-delete queues, so a test never competes with a deployed service. */
  readonly ephemeralQueues?: boolean;
  readonly logger?: HttpLogger;
  readonly clock?: () => string;
}

export interface Runtime {
  readonly server: Server;
  readonly app: ApplicationDeps;
  readonly projector: PublicCelebrationProjector;
  readonly publicStore: PublicCelebrationStore;
  readonly history: EventHistory;
  /** Present in memory mode, for tests that inspect the outbox directly. */
  readonly memory?: MemoryDatabase;
  readonly pool?: Pool;
  close(): Promise<void>;
}

const DEFAULT_RELAY_INTERVAL_MS = 500;

export function jsonLogger(): HttpLogger {
  const logger = new JsonLogger({ write: (line) => process.stdout.write(`${line}\n`) });
  return {
    info: (message, fields) => logger.log({ level: 'info', message, ...fields }),
    error: (message, fields) => logger.log({ level: 'error', message, ...fields })
  };
}

const silent: HttpLogger = { info: () => undefined, error: () => undefined };

interface Storage {
  readonly uow: UnitOfWork;
  readonly publicTransactions: PublicStoreTransaction;
  readonly publicStore: PublicCelebrationStore;
  readonly history: EventHistory;
  readonly memory?: MemoryDatabase;
  readonly pool?: Pool;
  readonly ready: () => Promise<boolean>;
}

async function storage(config: RuntimeConfig): Promise<Storage> {
  if (!config.databaseUrl) {
    const memory = new MemoryDatabase();
    return { uow: memory, publicTransactions: memory.publicTransactions, publicStore: { ...bindStore(memory) }, history: memory, memory, ready: async () => true };
  }
  const pool = createPool(config.databaseUrl);
  if (config.autoMigrate) await migrateUp(pool);
  return {
    uow: new PgUnitOfWork(pool), publicTransactions: new PgPublicTransactions(pool), publicStore: new PgPublicStore(pool), history: new PgEventHistory(pool), pool,
    ready: async () => { try { await pool.query('SELECT 1'); return true; } catch { return false; } }
  };
}

/** The memory store swaps its tables on commit, so reads must always go through the current instance. */
function bindStore(memory: MemoryDatabase): PublicCelebrationStore {
  return {
    getBySlug: async (slug) => memory.publicStore().getBySlug(slug),
    getByCelebrationId: async (id) => memory.publicStore().getByCelebrationId(id),
    upsert: async (row) => memory.publicStore().upsert(row),
    deleteByCelebrationId: async (id) => memory.publicStore().deleteByCelebrationId(id),
    markProcessed: async (id) => memory.publicStore().markProcessed(id),
    reset: async () => memory.publicStore().reset(),
    dump: async () => memory.publicStore().dump(),
    listSlugs: async (limit, offset) => memory.publicStore().listSlugs(limit, offset)
  };
}

export async function buildRuntime(config: RuntimeConfig = {}): Promise<Runtime> {
  const logger = config.logger ?? silent;
  const store = await storage(config);
  const app: ApplicationDeps = { uow: store.uow, clock: { now: config.clock ?? (() => new Date().toISOString()) }, ids: { next: () => randomUUID() } };
  await seedEventTypes(store.uow, config.seeds ?? (await readSeeds()));
  const projector = new PublicCelebrationProjector(store.publicTransactions);
  const authenticator = config.authenticator ?? jwtAuthenticator(httpJwks(config.jwksUrl ?? 'http://identity-service:8080/.well-known/jwks.json'));

  const closers: (() => Promise<void>)[] = [];
  const broker = config.rabbitmqUrl ? await AmqpBroker.connect(config.rabbitmqUrl, logger, `celebration-site-service:${config.queuePrefix ?? 'celebration'}`) : undefined;
  const bus = new InProcessBus();
  bus.subscribe(PROJECTED_EVENT_TYPES, async (envelope) => projector.apply(envelope));
  bus.subscribe(Object.values(TemplateEventType), templateCatalogHandler(app));

  if (broker) {
    const specs = consumerSpecs(app, projector, config.queuePrefix);
    await Promise.all(specs.map(async (spec) => broker.consume({ ...spec, ephemeral: config.ephemeralQueues ?? false })));
    closers.push(async () => broker.close());
  }
  if (store.memory) {
    // No broker in memory mode: committed events go straight to the in-process consumers.
    store.memory.onCommit((events) => { void events.reduce(async (previous, envelope) => { await previous; await bus.publish(envelope); }, Promise.resolve()); });
  }
  if (store.pool) {
    const relay: RelayLoop = startRelayLoop(createPgOutboxRelay(store.pool, broker ?? bus), config.relayIntervalMs ?? DEFAULT_RELAY_INTERVAL_MS, logger);
    const pool = store.pool;
    closers.push(async () => relay.stop(), async () => pool.end());
  }

  const server = createHttpServer({ app, authenticator, publicStore: store.publicStore, projector, history: store.history, ready: store.ready, logger });
  return {
    server, app, projector, publicStore: store.publicStore, history: store.history, memory: store.memory, pool: store.pool,
    close: async () => {
      await new Promise<void>((resolve) => { server.close(() => resolve()); });
      await closers.reduce(async (previous, close) => { await previous; await close(); }, Promise.resolve());
    }
  };
}
