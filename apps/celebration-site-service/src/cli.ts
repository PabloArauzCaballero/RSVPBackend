import { readSeeds, seedEventTypes } from './infrastructure/persistence/event-type-seeds.js';
import { migrateDown, migrateUp } from './infrastructure/persistence/postgres/migrator.js';
import { createPool } from './infrastructure/persistence/postgres/pg-database.js';
import { PgEventHistory, PgPublicTransactions } from './infrastructure/persistence/postgres/pg-projection.js';
import { PgUnitOfWork } from './infrastructure/persistence/postgres/pg-unit-of-work.js';
import { PublicCelebrationProjector } from './infrastructure/projection/public-celebration-projector.js';

/**
 * Operations CLI, against CELEBRATION_DATABASE_URL:
 *   node dist/cli.js migrate up | migrate down [steps] | seed | replay
 */

const url = process.env['CELEBRATION_DATABASE_URL'];
if (!url) throw new Error('CELEBRATION_DATABASE_URL is required');
const pool = createPool(url, 2);
const [command, argument, extra] = process.argv.slice(2);
const DOWN = 'down';

const commands: Readonly<Record<string, () => Promise<unknown>>> = {
  migrate: async () => (argument === DOWN ? migrateDown(pool, Number(extra ?? 1)) : migrateUp(pool)),
  seed: async () => seedEventTypes(new PgUnitOfWork(pool), await readSeeds()),
  replay: async () => new PublicCelebrationProjector(new PgPublicTransactions(pool)).replay(new PgEventHistory(pool))
};

const run = commands[command ?? ''];
if (!run) throw new Error(`Unknown command "${command}". Use: ${Object.keys(commands).join(', ')}`);
try {
  process.stdout.write(`${JSON.stringify({ command, result: await run() })}\n`);
} finally {
  await pool.end();
}
