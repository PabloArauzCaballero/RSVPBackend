// Runs the integration suite against the local docker compose stack, three times in a row (lane DoD).
import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  CELEBRATION_IT_ADMIN_URL: process.env.CELEBRATION_IT_ADMIN_URL ?? 'postgresql://postgres:local-postgres-password@localhost:5432/postgres',
  CELEBRATION_IT_RABBITMQ_URL: process.env.CELEBRATION_IT_RABBITMQ_URL ?? 'amqp://local-rabbitmq:local-rabbitmq-password@localhost:5672'
};
const runs = Number(process.env.RUNS ?? 3);
for (let run = 1; run <= runs; run += 1) {
  console.log(`--- integration run ${run}/${runs}`);
  const result = spawnSync(process.execPath, ['--test', 'test/postgres.integration.test.mjs'], { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
