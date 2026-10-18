import { buildRuntime, jsonLogger } from './composition.js';
import { jwtAuthenticator, type JsonWebKeySet } from './infrastructure/auth/jwt-authenticator.js';

/**
 * Process entry point. Configuration comes only from the environment:
 * CELEBRATION_DATABASE_URL (absent = in-memory mode), RABBITMQ_URL,
 * IDENTITY_JWKS_URL (or IDENTITY_JWKS_JSON, a static key set for local stacks without Identity),
 * PORT, CELEBRATION_AUTO_MIGRATE.
 */

const DEFAULT_PORT = 3001;
const TRUE = 'true';
const env = process.env;
const logger = jsonLogger();
const staticJwks = env['IDENTITY_JWKS_JSON'];

const runtime = await buildRuntime({
  databaseUrl: env['CELEBRATION_DATABASE_URL'],
  rabbitmqUrl: env['RABBITMQ_URL'],
  jwksUrl: env['IDENTITY_JWKS_URL'],
  // A static set is parsed once at boot; a malformed value fails fast.
  ...(staticJwks ? { authenticator: jwtAuthenticator({ fetch: async () => JSON.parse(staticJwks) as JsonWebKeySet }) } : {}),
  autoMigrate: env['CELEBRATION_AUTO_MIGRATE'] === TRUE,
  queuePrefix: env['CELEBRATION_QUEUE_PREFIX'],
  logger
});

const port = Number(env['PORT'] ?? DEFAULT_PORT);
runtime.server.listen(port, () => logger.info('celebration-site-service listening', { port, mode: env['CELEBRATION_DATABASE_URL'] ? 'postgres' : 'memory' }));

const shutdown = async (): Promise<void> => {
  logger.info('shutting down', {});
  await runtime.close();
  process.exit(0);
};
process.once('SIGTERM', () => { void shutdown(); });
process.once('SIGINT', () => { void shutdown(); });
