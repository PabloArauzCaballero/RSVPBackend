import type { EventEnvelope } from '../domain/event/envelope.js';
import type { AccessScope } from '../domain/policy/access.js';
import type { CelebrationRepository } from '../domain/port/celebration-repository.js';
import type { EventTypeRepository, TemplateCatalog } from '../domain/port/reference-data.js';

export interface Clock { now(): string }
export interface IdGenerator { next(): string }

export interface AuditEntry {
  readonly id: string;
  readonly celebrationId: string;
  readonly action: string;
  readonly actorId: string | null;
  readonly at: string;
  readonly eventId: string;
  readonly details: Readonly<Record<string, unknown>>;
}

/** Events are appended in the same transaction as the aggregate that produced them. */
export interface OutboxWriter { append(envelope: EventEnvelope): Promise<void> }
export interface AuditLog {
  append(entry: AuditEntry): Promise<void>;
  list(celebrationId: string): Promise<readonly AuditEntry[]>;
}

export interface TransactionContext {
  readonly celebrations: CelebrationRepository;
  readonly eventTypes: EventTypeRepository;
  readonly templates: TemplateCatalog;
  readonly outbox: OutboxWriter;
  readonly audit: AuditLog;
}

/**
 * One command = one transaction. Adapters must guarantee that the aggregate row,
 * its outbox events and its audit rows commit together or not at all, and that
 * the scope is applied (Postgres sets it for Row Level Security).
 */
export interface UnitOfWork {
  run<TResult>(scope: AccessScope, work: (tx: TransactionContext) => Promise<TResult>): Promise<TResult>;
}

/** Row of `read_public_celebration`: a denormalised page that answers in a single read. */
export interface PublicCelebrationRow {
  readonly slug: string;
  readonly celebrationId: string;
  readonly projectionVersion: number;
  readonly lastEventId: string;
  readonly updatedAt: string;
  readonly document: Readonly<Record<string, unknown>>;
}

export interface PublicCelebrationStore {
  getBySlug(slug: string): Promise<PublicCelebrationRow | undefined>;
  getByCelebrationId(celebrationId: string): Promise<PublicCelebrationRow | undefined>;
  upsert(row: PublicCelebrationRow): Promise<void>;
  deleteByCelebrationId(celebrationId: string): Promise<void>;
  /** Marks an event as applied; false if it was applied before (idempotent consumption). */
  markProcessed(eventId: string): Promise<boolean>;
  /** Drops every row and processed marker: the starting point of a replay. */
  reset(): Promise<void>;
  /** All rows ordered by slug, for byte-to-byte replay comparison. */
  dump(): Promise<readonly PublicCelebrationRow[]>;
  /** Published slugs for the sitemap, most recently updated first. */
  listSlugs(limit: number, offset: number): Promise<readonly PublicSlug[]>;
}

export interface PublicSlug {
  readonly slug: string;
  readonly updatedAt: string;
  readonly supportedLocales: readonly string[];
}

/** Ordered history of every event this service ever produced (its outbox), for replays. */
export interface EventHistory { all(): Promise<readonly EventEnvelope[]> }

export interface PublicStoreTransaction {
  run<TResult>(work: (store: PublicCelebrationStore) => Promise<TResult>): Promise<TResult>;
}
