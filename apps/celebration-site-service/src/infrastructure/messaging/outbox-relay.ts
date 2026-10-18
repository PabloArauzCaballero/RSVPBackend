import { OutboxRelay, PostgresOutboxRepository, type EventPublisher, type OutboxEvent, type SqlDatabase, type SqlExecutor } from '@rsvp/platform-outbox';
import type { EventEnvelope } from '../../domain/event/envelope.js';
import { flagSettings, inTransaction, type Pool } from '../persistence/postgres/pg-database.js';

/** Anything that delivers an envelope to the broker and resolves only once it is confirmed. */
export interface EnvelopePublisher { publish(envelope: EventEnvelope): Promise<void> }

const RELAY_FLAG = 'outbox_relay';

/** Every relay statement runs in a transaction with `app.outbox_relay = on`, the only scope that may read the outbox. */
function relayDatabase(pool: Pool): SqlDatabase {
  const executor = (client: { query: Pool['query'] }): SqlExecutor => ({
    query: async <TRow>(sql: string, parameters?: readonly unknown[]) => {
      const result = await client.query(sql, parameters ? [...parameters] : undefined);
      // pg returns untyped rows; the relay knows the outbox_event columns it selected.
      return { rows: result.rows as TRow[] };
    }
  });
  return {
    transaction: async (work) => inTransaction(pool, flagSettings(RELAY_FLAG), async (client) => work(executor(client))),
    query: async (sql, parameters) => inTransaction(pool, flagSettings(RELAY_FLAG), async (client) => executor(client).query(sql, parameters))
  };
}

/** The outbox row's `payload` column holds the complete contract envelope. */
const envelopePublisher = (publisher: EnvelopePublisher): EventPublisher => ({
  publish: async (event: OutboxEvent) => publisher.publish(event.payload as EventEnvelope)
});

export function createPgOutboxRelay(pool: Pool, publisher: EnvelopePublisher): OutboxRelay {
  return new OutboxRelay(new PostgresOutboxRepository(relayDatabase(pool)), envelopePublisher(publisher));
}

export interface RelayLoop { stop(): Promise<void> }

export interface RelayLogger { error(message: string, fields: Readonly<Record<string, unknown>>): void }

/** Polls the outbox; a crash between commit and publish only delays the event until the next tick. */
export function startRelayLoop(relay: Pick<OutboxRelay, 'relayBatch'>, intervalMs: number, logger: RelayLogger): RelayLoop {
  let running: Promise<unknown> = Promise.resolve();
  const timer = setInterval(() => {
    running = (async () => {
      await running;
      try {
        await relay.relayBatch();
      } catch (error) {
        logger.error('outbox relay batch failed', { error: error instanceof Error ? error.message : String(error) });
      }
    })();
  }, intervalMs);
  return {
    stop: async () => {
      clearInterval(timer);
      await running;
    }
  };
}
