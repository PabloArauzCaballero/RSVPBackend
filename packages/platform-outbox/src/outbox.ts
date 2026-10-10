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
}

/** SQL used by Postgres adapters to claim work without two relays publishing it. */
export const CLAIM_OUTBOX_SQL = `SELECT * FROM outbox_event
WHERE status = 'PENDING' AND available_at <= NOW()
ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1`;

export interface OutboxTransaction {
  insert(event: NewOutboxEvent): Promise<void>;
}

export interface OutboxRepository {
  transaction<T>(work: (tx: OutboxTransaction) => Promise<T>): Promise<T>;
  claim(limit: number, now: Date): Promise<OutboxEvent[]>;
  markPublished(id: string): Promise<void>;
  markForRetry(id: string, attempts: number, availableAt: Date, error: string, permanentlyFailed: boolean): Promise<void>;
}

export async function enqueueInTransaction(tx: OutboxTransaction, event: NewOutboxEvent): Promise<void> {
  await tx.insert(event);
}

/** Deterministic in-memory adapter, useful for unit tests and local examples. */
export class InMemoryOutboxRepository implements OutboxRepository {
  private readonly events = new Map<string, OutboxEvent>();
  async transaction<T>(work: (tx: OutboxTransaction) => Promise<T>): Promise<T> {
    const staged: NewOutboxEvent[] = [];
    const result = await work({ insert: async (event) => { staged.push(event); } });
    for (const event of staged) this.events.set(event.id, { ...event, status: 'PENDING', attempts: 0, availableAt: new Date(0), createdAt: new Date() });
    return result;
  }
  async claim(limit: number, now: Date): Promise<OutboxEvent[]> {
    const claimed = [...this.events.values()].filter((event) => event.status === 'PENDING' && event.availableAt <= now).slice(0, limit);
    for (const event of claimed) event.status = 'PROCESSING';
    return claimed.map((event) => ({ ...event }));
  }
  async markPublished(id: string): Promise<void> { const event = this.mustGet(id); event.status = 'PUBLISHED'; }
  async markForRetry(id: string, attempts: number, availableAt: Date, error: string, permanentlyFailed: boolean): Promise<void> {
    const event = this.mustGet(id); event.attempts = attempts; event.availableAt = availableAt; event.lastError = error; event.status = permanentlyFailed ? 'FAILED' : 'PENDING';
  }
  snapshot(): OutboxEvent[] { return [...this.events.values()].map((event) => ({ ...event })); }
  private mustGet(id: string): OutboxEvent { const event = this.events.get(id); if (!event) throw new Error(`Unknown outbox event ${id}`); return event; }
}
