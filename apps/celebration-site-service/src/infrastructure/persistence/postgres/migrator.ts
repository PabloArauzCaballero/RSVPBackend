import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { Pool } from './pg-database.js';

/**
 * Versioned, reversible migrations: `NNNN_name.up.sql` / `NNNN_name.down.sql`.
 * Each one runs in its own transaction and is recorded in `schema_migrations`.
 */

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../../../db/migrations/', import.meta.url));
const UP_SUFFIX = '.up.sql';
const DOWN_SUFFIX = '.down.sql';

const BOOTSTRAP = `CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schema_migrations') THEN
    CREATE POLICY schema_migrations_tooling ON schema_migrations USING (true) WITH CHECK (true);
  END IF;
END $$;`;

async function migrationNames(directory: string): Promise<string[]> {
  return (await readdir(directory)).filter((file) => file.endsWith(UP_SUFFIX)).map((file) => file.slice(0, -UP_SUFFIX.length)).sort();
}

async function applied(pool: Pool): Promise<Set<string>> {
  await pool.query(BOOTSTRAP);
  const result = await pool.query<{ readonly version: string }>('SELECT version FROM schema_migrations');
  return new Set(result.rows.map((row) => row.version));
}

async function runFile(pool: Pool, sql: string, record: { readonly text: string; readonly values: readonly unknown[] }): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(record.text, [...record.values]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Applies pending migrations in order; returns the names applied. */
export async function migrateUp(pool: Pool, directory = MIGRATIONS_DIR): Promise<string[]> {
  const done = await applied(pool);
  const pending = (await migrationNames(directory)).filter((name) => !done.has(name));
  await pending.reduce(async (previous, name) => {
    await previous;
    await runFile(pool, await readFile(join(directory, `${name}${UP_SUFFIX}`), 'utf8'), { text: 'INSERT INTO schema_migrations (version) VALUES ($1)', values: [name] });
  }, Promise.resolve());
  return pending;
}

/** Reverts the last `steps` applied migrations, newest first. */
export async function migrateDown(pool: Pool, steps = 1, directory = MIGRATIONS_DIR): Promise<string[]> {
  const done = await applied(pool);
  const targets = (await migrationNames(directory)).filter((name) => done.has(name)).reverse().slice(0, steps);
  await targets.reduce(async (previous, name) => {
    await previous;
    await runFile(pool, await readFile(join(directory, `${name}${DOWN_SUFFIX}`), 'utf8'), { text: 'DELETE FROM schema_migrations WHERE version = $1', values: [name] });
  }, Promise.resolve());
  return targets;
}
