import type { EventEnvelope } from '../../../domain/event/envelope.js';
import type { EventHistory, PublicCelebrationRow, PublicCelebrationStore, PublicSlug, PublicStoreTransaction } from '../../../application/ports.js';
import { flagSettings, inTransaction, type Pool } from './pg-database.js';

interface Queryable {
  query<TRow extends object>(text: string, values?: readonly unknown[]): Promise<{ readonly rows: TRow[] }>;
}

interface PublicRow {
  readonly slug: string; readonly celebration_id: string; readonly projection_version: number;
  readonly last_event_id: string; readonly updated_at: string; readonly document: Record<string, unknown>;
}

const toRow = (row: PublicRow): PublicCelebrationRow => ({
  slug: row.slug, celebrationId: row.celebration_id, projectionVersion: row.projection_version,
  lastEventId: row.last_event_id, updatedAt: row.updated_at, document: row.document
});

const SELECT_PUBLIC = 'SELECT slug, celebration_id, projection_version, last_event_id, updated_at, document FROM read_public_celebration';

export class PgPublicStore implements PublicCelebrationStore {
  constructor(private readonly db: Queryable) {}

  /** The public page: exactly one query, never touching the write model (REQ-15-02). */
  async getBySlug(slug: string): Promise<PublicCelebrationRow | undefined> {
    const result = await this.db.query<PublicRow>(`${SELECT_PUBLIC} WHERE slug = $1`, [slug]);
    return result.rows[0] && toRow(result.rows[0]);
  }
  async getByCelebrationId(celebrationId: string): Promise<PublicCelebrationRow | undefined> {
    const result = await this.db.query<PublicRow>(`${SELECT_PUBLIC} WHERE celebration_id = $1`, [celebrationId]);
    return result.rows[0] && toRow(result.rows[0]);
  }
  async upsert(row: PublicCelebrationRow): Promise<void> {
    await this.db.query('DELETE FROM read_public_celebration WHERE celebration_id = $1 AND slug <> $2', [row.celebrationId, row.slug]);
    await this.db.query(
      `INSERT INTO read_public_celebration (slug, celebration_id, projection_version, last_event_id, updated_at, document)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (slug) DO UPDATE SET celebration_id = EXCLUDED.celebration_id, projection_version = EXCLUDED.projection_version,
         last_event_id = EXCLUDED.last_event_id, updated_at = EXCLUDED.updated_at, document = EXCLUDED.document`,
      [row.slug, row.celebrationId, row.projectionVersion, row.lastEventId, row.updatedAt, JSON.stringify(row.document)]
    );
  }
  async deleteByCelebrationId(celebrationId: string): Promise<void> {
    await this.db.query('DELETE FROM read_public_celebration WHERE celebration_id = $1', [celebrationId]);
  }
  async markProcessed(eventId: string): Promise<boolean> {
    const result = await this.db.query<{ readonly event_id: string }>(
      'INSERT INTO read_public_celebration_processed (event_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING event_id', [eventId]
    );
    return Boolean(result.rows.length);
  }
  async reset(): Promise<void> {
    await this.db.query('DELETE FROM read_public_celebration');
    await this.db.query('DELETE FROM read_public_celebration_processed');
  }
  async dump(): Promise<readonly PublicCelebrationRow[]> {
    const result = await this.db.query<PublicRow>(`${SELECT_PUBLIC} ORDER BY slug`);
    return result.rows.map(toRow);
  }
  async listSlugs(limit: number, offset: number): Promise<readonly PublicSlug[]> {
    const result = await this.db.query<{ readonly slug: string; readonly updated_at: string; readonly locales: string[] }>(
      `SELECT slug, updated_at, ARRAY(SELECT jsonb_array_elements_text(document->'supportedLocales')) AS locales
       FROM read_public_celebration ORDER BY updated_at DESC, slug LIMIT $1 OFFSET $2`, [limit, offset]
    );
    return result.rows.map((row) => ({ slug: row.slug, updatedAt: row.updated_at, supportedLocales: row.locales }));
  }
}

/** Projector transactions run with `app.projector = on`, the only role allowed to write the read model. */
export class PgPublicTransactions implements PublicStoreTransaction {
  constructor(private readonly pool: Pool) {}
  async run<TResult>(work: (store: PublicCelebrationStore) => Promise<TResult>): Promise<TResult> {
    return inTransaction(this.pool, flagSettings('projector'), async (client) => work(new PgPublicStore(client)));
  }
}

/** The outbox is the event history of this service; replays read it in commit order. */
export class PgEventHistory implements EventHistory {
  constructor(private readonly pool: Pool) {}
  async all(): Promise<readonly EventEnvelope[]> {
    return inTransaction(this.pool, flagSettings('outbox_relay'), async (client) => {
      const result = await client.query<{ readonly payload: EventEnvelope }>('SELECT payload FROM outbox_event ORDER BY event_sequence');
      return result.rows.map((row) => row.payload);
    });
  }
}
