import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import pg from 'pg';
import amqp from 'amqplib';
import {
  createPool, migrateUp, migrateDown, createPgOutboxRelay, PgPublicStore, getPublicCelebration, seedEventTypes, readSeedFile, SEEDS_DIR
} from '../dist/index.js';
import { start, tokenFor, user, createWedding, CORE_SEEDS } from './support.mjs';

/**
 * Runs against real infrastructure (docker compose up). Opt in with
 *   CELEBRATION_IT_ADMIN_URL=postgresql://postgres:local-postgres-password@localhost:5432/postgres
 *   CELEBRATION_IT_RABBITMQ_URL=amqp://local-rabbitmq:local-rabbitmq-password@localhost:5672   (optional)
 * Each run creates and drops its own database owned by celebration_owner.
 */
const adminUrl = process.env.CELEBRATION_IT_ADMIN_URL;
const rabbitUrl = process.env.CELEBRATION_IT_RABBITMQ_URL;
const ownerPassword = process.env.CELEBRATION_OWNER_PASSWORD ?? 'local-celebration-password';
const database = `celebration_it_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const waitFor = async (predicate, timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) { if (await predicate()) return true; await new Promise((r) => setTimeout(r, 50)); }
  return false;
};

describe('Postgres + RabbitMQ integration', { skip: adminUrl ? false : 'set CELEBRATION_IT_ADMIN_URL to run' }, () => {
  let admin;
  let appUrl;
  let pool;
  let server;
  const host = user();
  const token = tokenFor(host);

  before(async () => {
    admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${database} OWNER celebration_owner`);
    const url = new URL(adminUrl);
    appUrl = `postgresql://celebration_owner:${ownerPassword}@${url.host}/${database}`;
    pool = createPool(appUrl, 4);
  });

  after(async () => {
    await server?.close();
    await pool?.end();
    await admin?.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin?.end();
  });

  test('migrations go up, down and up again; every table has RLS enabled and forced', async () => {
    assert.deepEqual(await migrateUp(pool), ['0001_celebration_core', '0002_public_read_model']);
    assert.deepEqual(await migrateUp(pool), [], 'idempotent');
    const tables = await pool.query(`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace ORDER BY relname`);
    assert.ok(tables.rows.length >= 11);
    assert.deepEqual(tables.rows.filter((row) => !row.relrowsecurity || !row.relforcerowsecurity).map((row) => row.relname), []);
    const naive = await pool.query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'`);
    assert.deepEqual(naive.rows, [], 'REQ-14-03: no timestamp without time zone');
    assert.deepEqual(await migrateDown(pool, 2), ['0002_public_read_model', '0001_celebration_core']);
    const left = await pool.query(`SELECT relname FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace AND relname <> 'schema_migrations'`);
    assert.deepEqual(left.rows, []);
    await migrateUp(pool);
  });

  test('the service runs on Postgres end to end', async () => {
    server = await start({ databaseUrl: appUrl, autoMigrate: false, relayIntervalMs: 50, rabbitmqUrl: rabbitUrl, queuePrefix: database, ephemeralQueues: true });
    assert.equal((await server.api('GET', '/celebrations/ready')).body.status, 'ready');
    const c = await createWedding(server.api, token);
    assert.equal((await server.api('GET', `/celebrations/${c.id}`, { token })).body.content.title, 'Ana y Luis');
  });

  test('REQ-10-06 · RLS: the owner role itself reads nothing without a scope, and another user reads nothing either', async () => {
    const c = await createWedding(server.api, token);
    const raw = await pool.query('SELECT count(*)::int AS n FROM celebration WHERE id = $1', [c.id]);
    assert.equal(raw.rows[0].n, 0, 'FORCE ROW LEVEL SECURITY applies to the table owner');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.user_id', $1, true)`, [randomUUID()]);
      assert.equal((await client.query('SELECT count(*)::int AS n FROM celebration WHERE id = $1', [c.id])).rows[0].n, 0);
      assert.equal((await client.query('SELECT count(*)::int AS n FROM celebration_audit WHERE celebration_id = $1', [c.id])).rows[0].n, 0);
      await client.query(`SELECT set_config('app.user_id', $1, true)`, [host.sub]);
      assert.equal((await client.query('SELECT count(*)::int AS n FROM celebration WHERE id = $1', [c.id])).rows[0].n, 1);
      await client.query('ROLLBACK');
    } finally { client.release(); }
    assert.equal((await server.api('GET', `/celebrations/${c.id}`, { token: tokenFor(user()) })).status, 404);
  });

  test('REQ-13-06 · slug uniqueness is global across tenants (unique index, 409)', async () => {
    const slug = `pg-${randomUUID().slice(0, 8)}`;
    assert.equal((await server.api('POST', '/celebrations', { token, body: { slug, eventTypeCode: 'WEDDING' } })).status, 201);
    const other = await server.api('POST', '/celebrations', { token: tokenFor(user()), body: { slug, eventTypeCode: 'WEDDING' } });
    assert.equal(other.status, 409);
    assert.equal(other.body.code, 'SLUG_TAKEN');
  });

  test('REQ-10-04 · two concurrent writes on Postgres: exactly one 200 and one 409, ten times in a row', async () => {
    for (let round = 0; round < 10; round += 1) {
      const c = await createWedding(server.api, token);
      const statuses = (await Promise.all([1, 2].map((n) => server.api('PATCH', `/celebrations/${c.id}`, { token, ifMatch: 1, body: { content: { title: `t${n}` } } })))).map((r) => r.status).sort();
      assert.deepEqual(statuses, [200, 409], `round ${round}`);
    }
  });

  test('outbox is atomic with the aggregate: a rejected command writes no event', async () => {
    const c = await createWedding(server.api, token, { content: { title: 'Sin todo' } });
    const count = async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT set_config('app.outbox_relay', 'on', true)`);
        const result = await client.query('SELECT count(*)::int AS n FROM outbox_event WHERE tenant_id = $1', [c.id]);
        await client.query('COMMIT');
        return result.rows[0].n;
      } finally { client.release(); }
    };
    assert.equal(await count(), 1);
    assert.equal((await server.api('POST', `/celebrations/${c.id}/publish`, { token, ifMatch: 1 })).status, 422);
    assert.equal(await count(), 1);
  });

  test('crash between commit and publish: the event still leaves when a relay runs again', async () => {
    const status = async (id) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT set_config('app.outbox_relay', 'on', true)`);
        const result = await client.query('SELECT status, attempts FROM outbox_event WHERE tenant_id = $1', [id]);
        await client.query('COMMIT');
        return result.rows[0];
      } finally { client.release(); }
    };
    // Simulates the process dying after COMMIT: a relay whose broker fails leaves the row pending for retry.
    const failing = createPgOutboxRelay(pool, { publish: async () => { throw new Error('broker down'); } });
    const c = await createWedding(server.api, token);
    await failing.relayBatch(500);
    const afterCrash = await status(c.id);
    // The service's own relay may be holding the lease at this instant; any state but FAILED means not lost.
    assert.ok(['PENDING', 'PROCESSING', 'PUBLISHED'].includes(afterCrash.status), `never lost, never FAILED after one attempt (was ${afterCrash.status})`);
    // The relay of the restarted service eventually publishes it (backoff included).
    const healthy = createPgOutboxRelay(pool, { publish: async () => undefined });
    assert.ok(await waitFor(async () => { await healthy.relayBatch(500); return (await status(c.id)).status === 'PUBLISHED'; }, 10_000));
  });

  test('REQ-15 · publish reaches the projection through the relay (and RabbitMQ when configured); replay is byte-identical', async () => {
    const c = await createWedding(server.api, token, { supportedLocales: ['es-BO', 'en-US'], translations: { 'en-US': { title: 'Ana & Luis' } } });
    await server.api('POST', `/celebrations/${c.id}/publish`, { token, ifMatch: 1 });
    assert.ok(await waitFor(async () => (await server.api('GET', `/celebrations/public/${c.slug}`)).status === 200), 'public page appears');
    assert.equal((await server.api('GET', `/celebrations/public/${c.slug}`, { headers: { 'accept-language': 'en-US' } })).body.content.title, 'Ana & Luis');
    assert.ok((await server.api('GET', '/celebrations/public?limit=100')).body.items.some((item) => item.slug === c.slug && item.supportedLocales.includes('en-US')));
    const before = JSON.stringify(await server.runtime.publicStore.dump());
    const replay = await server.api('POST', '/celebrations/admin/projections/public/replay', { token: tokenFor(user({ roles: ['ADMIN'] })) });
    assert.equal(replay.status, 200);
    assert.equal(JSON.stringify(await server.runtime.publicStore.dump()), before);
  });

  test('REQ-15-02 · the public page is resolved with exactly one SQL query on the read model', async () => {
    const c = await createWedding(server.api, token);
    await server.api('POST', `/celebrations/${c.id}/publish`, { token, ifMatch: 1 });
    assert.ok(await waitFor(async () => (await server.api('GET', `/celebrations/public/${c.slug}`)).status === 200));
    const seen = [];
    const counting = { query: async (text, values) => { seen.push(text); return pool.query(text, values); } };
    const view = await getPublicCelebration(new PgPublicStore(counting), c.slug, 'es-BO');
    assert.equal(view.slug, c.slug);
    assert.equal(seen.length, 1);
    assert.match(seen[0], /FROM read_public_celebration/);
    assert.doesNotMatch(seen[0], /\bcelebration\b(?!_)/);
  });

  test('REQ-11-06 · BAUTIZO inserted into Postgres at runtime is usable immediately', async () => {
    assert.equal((await server.api('POST', '/celebrations', { token, body: { slug: `bz-${randomUUID().slice(0, 6)}`, eventTypeCode: 'BAUTIZO' } })).status, 422);
    await seedEventTypes(server.runtime.app.uow, [await readSeedFile(join(SEEDS_DIR, '003-bautizo.json'))]);
    await seedEventTypes(server.runtime.app.uow, [await readSeedFile(join(SEEDS_DIR, '003-bautizo.json'))]);
    const created = await server.api('POST', '/celebrations', { token, body: { slug: `bz-${randomUUID().slice(0, 6)}`, eventTypeCode: 'BAUTIZO', content: { title: 'Bautizo', eventDate: '2026-11-08T11:00', venueName: 'Parroquia', childName: 'Mateo', hosts: { PARENT: 'Lucía' } } } });
    assert.equal((await server.api('POST', `/celebrations/${created.body.id}/publish`, { token, ifMatch: 1 })).status, 200);
  });

  test('REQ-12-02 · with RabbitMQ: the settings event arrives on celebration.events with the contract routing key', { skip: rabbitUrl ? false : 'set CELEBRATION_IT_RABBITMQ_URL' }, async () => {
    const connection = await amqp.connect(rabbitUrl);
    const channel = await connection.createChannel();
    const { queue } = await channel.assertQueue('', { exclusive: true });
    await channel.bindQueue(queue, 'celebration.events', 'celebration.settings.updated.v1');
    const received = [];
    await channel.consume(queue, (message) => { received.push(JSON.parse(message.content.toString())); channel.ack(message); });
    const c = await createWedding(server.api, token);
    await server.api('PUT', `/celebrations/${c.id}/settings`, { token, ifMatch: 1, body: { giftReservationMode: 'AUTO_ACCEPT' } });
    assert.ok(await waitFor(async () => received.some((event) => event.tenant.celebrationId === c.id)));
    const event = received.find((item) => item.tenant.celebrationId === c.id);
    assert.equal(event.payload.giftReservationMode, 'AUTO_ACCEPT');
    await connection.close();
  });
  test('the broker connection survives RabbitMQ dropping it: it reconnects and events keep flowing', { skip: rabbitUrl ? false : 'set CELEBRATION_IT_RABBITMQ_URL' }, async () => {
    const management = 'http://localhost:15672/api/connections';
    const auth = { authorization: `Basic ${Buffer.from('local-rabbitmq:local-rabbitmq-password').toString('base64')}` };
    const name = `celebration-site-service:${database}`;
    const ours = async () => (await (await fetch(management, { headers: auth })).json()).filter((connection) => connection.client_properties?.connection_name === name);
    assert.ok(await waitFor(async () => (await ours()).length > 0, 15_000), 'connection visible in the management API');
    for (const connection of await ours()) await fetch(`${management}/${encodeURIComponent(connection.name)}`, { method: 'DELETE', headers: { ...auth, 'x-reason': 'integration test' } });
    assert.ok(await waitFor(async () => (await ours()).length > 0, 30_000), 'reconnected');
    const c = await createWedding(server.api, token);
    await server.api('POST', `/celebrations/${c.id}/publish`, { token, ifMatch: 1 });
    assert.ok(await waitFor(async () => (await server.api('GET', `/celebrations/public/${c.slug}`)).status === 200, 30_000), 'publish reached the projection through the new connection');
  });
});

export { CORE_SEEDS };
