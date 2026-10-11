export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'FAILED';

export interface NewOutboxEvent {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventName: string;
  payload: unknown;
  correlationId: string;
  tenantId: string;
}

export interface OutboxEvent extends NewOutboxEvent {
  status: OutboxStatus;
  attempts: number;
  availableAt: Date;
  createdAt: Date;
  lastError?: string;
  leaseExpiresAt?: Date;
}

/** SQL used by Postgres adapters to claim work without two relays publishing it. */
export const CLAIM_OUTBOX_SQL = `WITH candidates AS (
  SELECT id FROM outbox_event
  WHERE (status = 'PENDING' AND available_at <= NOW())
     OR (status = 'PROCESSING' AND lease_expires_at <= NOW())
  ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1
)
UPDATE outbox_event AS event
SET status = 'PROCESSING', lease_expires_at = NOW() + ($2 * INTERVAL '1 millisecond')
FROM candidates WHERE event.id = candidates.id
RETURNING event.*`;

export const DEFAULT_PROCESSING_LEASE_MS = 60_000;

export interface OutboxTransaction {
  insert(event: NewOutboxEvent): Promise<void>;
}

export interface OutboxRepository {
  transaction<T>(work: (tx: OutboxTransaction) => Promise<T>): Promise<T>;
  claim(limit: number, now: Date): Promise<OutboxEvent[]>;
  markPublished(id: string): Promise<void>;
  markForRetry(id: string, attempts: number, availableAt: Date, error: string, permanentlyFailed: boolean): Promise<void>;
}

export interface SqlResult<T> { rows: T[]; }
export interface SqlExecutor { query<T>(sql: string, parameters?: readonly unknown[]): Promise<SqlResult<T>>; }
export interface SqlDatabase {
  transaction<T>(work: (transaction: SqlExecutor) => Promise<T>): Promise<T>;
  query<T>(sql: string, parameters?: readonly unknown[]): Promise<SqlResult<T>>;
}

/**
 * Postgres adapter kept dependency-free so Nest services can supply their own
 * pg/Prisma transaction executor. Aggregate writes and outbox inserts use the
 * same `database.transaction` boundary.
 */
export class PostgresOutboxRepository implements OutboxRepository {
  constructor(private readonly database: SqlDatabase, private readonly leaseMs = DEFAULT_PROCESSING_LEASE_MS) {}

  async transaction<T>(work: (tx: OutboxTransaction) => Promise<T>): Promise<T> {
    return this.database.transaction(async (transaction) => work({
      insert: async (event) => {
        await transaction.query(
          `INSERT INTO outbox_event (id, aggregate_type, aggregate_id, event_name, payload, correlation_id, tenant_id)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
          [event.id, event.aggregateType, event.aggregateId, event.eventName, JSON.stringify(event.payload), event.correlationId, event.tenantId]
        );
      }
    }));
  }

  async claim(limit: number, _now: Date): Promise<OutboxEvent[]> {
    const result = await this.database.query<OutboxEvent>(CLAIM_OUTBOX_SQL, [limit, this.leaseMs]);
    return result.rows;
  }
  async markPublished(id: string): Promise<void> {
    await this.database.query(`UPDATE outbox_event SET status = 'PUBLISHED', published_at = NOW(), lease_expires_at = NULL WHERE id = $1`, [id]);
  }
  async markForRetry(id: string, attempts: number, availableAt: Date, error: string, permanentlyFailed: boolean): Promise<void> {
    await this.database.query(
      `UPDATE outbox_event SET status = $2, attempts = $3, available_at = $4, last_error = $5, lease_expires_at = NULL WHERE id = $1`,
      [id, permanentlyFailed ? 'FAILED' : 'PENDING', attempts, availableAt, error]
    );
  }
}

export async function enqueueInTransaction(tx: OutboxTransaction, event: NewOutboxEvent): Promise<void> {
  await tx.insert(event);
}

/** Deterministic in-memory adapter, useful for unit tests and local examples. */
export class InMemoryOutboxRepository implements OutboxRepository {
  private readonly events = new Map<string, OutboxEvent>();
  constructor(private readonly leaseMs = DEFAULT_PROCESSING_LEASE_MS) {}
  async transaction<T>(work: (tx: OutboxTransaction) => Promise<T>): Promise<T> {
    const staged: NewOutboxEvent[] = [];
    const result = await work({ insert: async (event) => { staged.push(event); } });
    for (const event of staged) this.events.set(event.id, { ...event, status: 'PENDING', attempts: 0, availableAt: new Date(0), createdAt: new Date() });
    return result;
  }
  async claim(limit: number, now: Date): Promise<OutboxEvent[]> {
    const claimed = [...this.events.values()].filter((event) =>
      (event.status === 'PENDING' && event.availableAt <= now) ||
      (event.status === 'PROCESSING' && event.leaseExpiresAt !== undefined && event.leaseExpiresAt <= now)
    ).slice(0, limit);
    for (const event of claimed) {
      event.status = 'PROCESSING';
      event.leaseExpiresAt = new Date(now.getTime() + this.leaseMs);
    }
    return claimed.map((event) => ({ ...event }));
  }
  async markPublished(id: string): Promise<void> { const event = this.mustGet(id); event.status = 'PUBLISHED'; event.leaseExpiresAt = undefined; }
  async markForRetry(id: string, attempts: number, availableAt: Date, error: string, permanentlyFailed: boolean): Promise<void> {
    const event = this.mustGet(id); event.attempts = attempts; event.availableAt = availableAt; event.lastError = error; event.status = permanentlyFailed ? 'FAILED' : 'PENDING'; event.leaseExpiresAt = undefined;
  }
  snapshot(): OutboxEvent[] { return [...this.events.values()].map((event) => ({ ...event })); }
  private mustGet(id: string): OutboxEvent { const event = this.events.get(id); if (!event) throw new Error(`Unknown outbox event ${id}`); return event; }
}
