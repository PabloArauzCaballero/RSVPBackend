import pg from 'pg';
import { ConflictError } from '../../../domain/errors.js';
import type { AccessScope } from '../../../domain/policy/access.js';

/** pg type OIDs whose default parsing would leak local-time `Date`s or lose precision. */
const PG_TIMESTAMPTZ = 1184;
const PG_TIMESTAMP = 1114;
const PG_INT8 = 20;
const UNIQUE_VIOLATION = '23505';
const SLUG_CONSTRAINT = 'celebration_slug_key';
const SETTING_ON = 'on';
const SETTING_OFF = 'off';

const types = {
  getTypeParser: ((oid: number, format?: string) => {
    if (oid === PG_TIMESTAMPTZ || oid === PG_TIMESTAMP) return (value: string) => new Date(value).toISOString();
    if (oid === PG_INT8) return (value: string) => Number(value);
    return pg.types.getTypeParser(oid, format as 'text');
  }) as typeof pg.types.getTypeParser
};

export type Pool = pg.Pool;
export type Client = pg.PoolClient;

const DEFAULT_POOL_SIZE = 10;

export function createPool(connectionString: string, max = DEFAULT_POOL_SIZE): Pool {
  return new pg.Pool({ connectionString, max, types, application_name: 'celebration-site-service' });
}

/** Session settings read by the RLS helper functions of migration 0001. */
export type SessionSettings = Readonly<Record<string, string>>;

export function scopeSettings(scope: AccessScope): SessionSettings {
  return {
    'app.user_id': scope.userId,
    'app.organization_ids': scope.organizationIds.join(','),
    'app.is_admin': scope.admin ? SETTING_ON : SETTING_OFF
  };
}

export const flagSettings = (...flags: readonly string[]): SessionSettings => Object.fromEntries(flags.map((flag) => [`app.${flag}`, SETTING_ON]));

function translateError(error: unknown): unknown {
  if (error instanceof pg.DatabaseError && error.code === UNIQUE_VIOLATION && error.constraint === SLUG_CONSTRAINT) {
    return new ConflictError('SLUG_TAKEN', 'That slug is already in use', { field: 'slug' });
  }
  return error;
}

/**
 * BEGIN; set_config(..., true) for each setting (transaction-local, so a pooled
 * connection never carries a previous tenant); work; COMMIT — or ROLLBACK.
 */
export async function inTransaction<TResult>(pool: Pool, settings: SessionSettings, work: (client: Client) => Promise<TResult>): Promise<TResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await Promise.all(Object.entries(settings).map(async ([key, value]) => client.query('SELECT set_config($1, $2, true)', [key, value])));
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw translateError(error);
  } finally {
    client.release();
  }
}
