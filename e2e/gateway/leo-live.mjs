// Live end-to-end check of lane B (Leo) through Kong, against the running compose stack.
// It starts the two services with a throw-away RS256 key (no Identity needed), then walks the
// host journey: create → template events → upload a real photo to MinIO → publish → public page.
//   node e2e/gateway/leo-live.mjs            (KEEP_RUNNING=1 leaves the services up)
import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';

const root = fileURLToPath(new URL('../..', import.meta.url));
const gateway = process.env.GATEWAY_URL ?? 'http://localhost:8000';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwks = JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'live-e2e', alg: 'RS256', use: 'sig' }] });
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const sign = (claims) => {
  const head = `${b64({ alg: 'RS256', typ: 'JWT', kid: 'live-e2e' })}.${b64({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 900, ...claims })}`;
  return `${head}.${createSign('RSA-SHA256').update(head).sign(privateKey).toString('base64url')}`;
};
const step = (label) => console.log(`\n▶ ${label}`);
const ok = (label, detail = '') => console.log(`  ✔ ${label}${detail ? ` — ${detail}` : ''}`);

step('docker compose --profile apps up (celebration + template/media + relay + consumer)');
const up = spawnSync('docker', ['compose', '--profile', 'apps', 'up', '-d', '--build', '--wait', 'celebration-site-service', 'template-media-service', 'template-media-relay', 'template-media-consumer'],
  { cwd: root, env: { ...process.env, IDENTITY_JWKS_JSON: jwks }, stdio: 'inherit' });
assert.equal(up.status, 0, 'compose up failed');

const call = async (method, path, { token, body, ifMatch, headers = {} } = {}) => {
  const response = await fetch(`${gateway}${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...(ifMatch ? { 'if-match': `"${ifMatch}"` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : undefined };
};
const eventually = async (label, probe, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe().catch(() => undefined);
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};

/** A real 640×400 PNG, built byte by byte (no image library needed on this side). */
function png(width = 640, height = 400) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buffer) => { let c = 0xffffffff; for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const length = Buffer.alloc(4); length.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([length, body, sum]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const rows = Buffer.concat(Array.from({ length: height }, (_, y) => Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, y % 256)])));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

step('health through Kong');
await eventually('celebration health', async () => (await call('GET', '/celebrations/health')).status === 200, 90_000);
await eventually('media health', async () => (await call('GET', '/media/health')).status === 200, 90_000);
ok('GET /celebrations/health and /media/health → 200');

const host = randomUUID();
const token = sign({ sub: host, roles: ['HOST'], organizationIds: [] });
assert.equal((await call('POST', '/celebrations', { body: { slug: 'x', eventTypeCode: 'WEDDING' } })).status, 401);
ok('no token → 401 (validated by the service; Kong OSS cannot check JWKS)');

step('create a wedding');
const slug = `boda-live-${randomUUID().slice(0, 8)}`;
const created = await call('POST', '/celebrations', { token, body: { slug, eventTypeCode: 'WEDDING', supportedLocales: ['es-BO', 'en-US'], content: { title: 'Ana y Luis', eventDate: '2026-12-19T19:00', venueName: 'Hacienda El Prado', hosts: { BRIDE: 'Ana', GROOM: 'Luis' } }, translations: { 'en-US': { title: 'Ana & Luis' } } } });
assert.equal(created.status, 201, JSON.stringify(created.body));
let version = created.body.version;
const id = created.body.id;
ok('POST /celebrations → 201', `id ${id}, RESTRICTED by default: ${created.body.settings.giftReservationMode}`);
assert.equal((await call('GET', `/celebrations/${id}`, { token: sign({ sub: randomUUID() }) })).status, 404);
ok('another user → 404');

step('templates published by Django reach the celebration service by RabbitMQ');
const templates = await eventually('wedding templates', async () => { const r = await call('GET', '/media/templates?eventTypeTags=wedding'); return r.body?.items?.length ? r.body.items : undefined; });
ok('GET /media/templates?eventTypeTags=wedding', templates.map((t) => t.name).join(', '));
const chosen = templates.find((t) => t.layout === 'classic') ?? templates[0];
const selected = await eventually('template_reference via template.template.published.v1', async () => {
  const r = await call('PUT', `/celebrations/${id}/template`, { token, ifMatch: version, body: { templateId: chosen.id } });
  return r.status === 200 ? r : undefined;
});
version = selected.body.version;
ok('PUT /celebrations/:id/template → 200', chosen.name);

step('upload a real photo straight to MinIO');
const photo = png();
const intent = await eventually('celebration_access via celebration.celebration.created.v1', async () => {
  const r = await call('POST', '/media/uploads/presign', { token, body: { celebrationId: id, filename: 'portada.png', contentType: 'image/png', sizeBytes: photo.length } });
  return r.status === 201 ? r.body : undefined;
});
ok('POST /media/uploads/presign → 201', new URL(intent.uploadUrl).host);
const put = await fetch(intent.uploadUrl, { method: 'PUT', headers: intent.requiredHeaders, body: photo });
assert.equal(put.status, 200);
ok('PUT to the presigned URL → 200 (bytes never touched the service)');
const completed = await call('POST', `/media/uploads/${intent.assetId}/complete`, { token });
assert.equal(completed.status, 200, JSON.stringify(completed.body));
assert.deepEqual(Object.keys(completed.body.variants).sort(), ['full', 'medium', 'thumb', 'webp']);
ok('POST /media/uploads/:id/complete → PROCESSED', 'thumb, medium, full, webp');
const thumb = await fetch(completed.body.variants.thumb);
assert.equal(thumb.headers.get('content-type'), 'image/webp');
ok('thumb served by MinIO', `${thumb.headers.get('content-length')} bytes webp`);

step('settings and publish');
const settings = await call('PUT', `/celebrations/${id}/settings`, { token, ifMatch: version, body: { giftReservationMode: 'AUTO_ACCEPT', rsvpDeadline: '2026-12-10T23:59:00-04:00' } });
assert.equal(settings.status, 200);
version = settings.body.version;
ok('PUT settings → 200', 'celebration.settings.updated.v1 to the outbox');
const published = await call('POST', `/celebrations/${id}/publish`, { token, ifMatch: version });
assert.equal(published.status, 200, JSON.stringify(published.body));
ok('POST publish → 200');

step('public page (read model) and public gallery');
const page = await eventually('read_public_celebration', async () => { const r = await call('GET', `/celebrations/public/${slug}`, { headers: { 'accept-language': 'en-US' } }); return r.status === 200 ? r : undefined; });
assert.equal(page.body.content.title, 'Ana & Luis');
assert.deepEqual(page.body.localTimes.eventDate, { date: '2026-12-19', time: '19:00', timeZone: 'America/La_Paz', utcOffset: '-04:00' });
assert.equal(page.body.templateId, chosen.id);
ok(`GET /celebrations/public/${slug} (en-US)`, `"${page.body.content.title}", ${page.body.localTimes.eventDate.date} ${page.body.localTimes.eventDate.time} La Paz`);
const gallery = await eventually('public gallery', async () => { const r = await call('GET', `/media/public/celebrations/${id}/assets`); return r.status === 200 && r.body.items.length ? r : undefined; });
ok('GET /media/public/celebrations/:id/assets', `${gallery.body.items.length} photo(s), cover ${gallery.body.items[0].isCover}`);
const stable = gallery.body.items[0].variants.full;
assert.ok(stable.startsWith(`${gateway}/media/public/assets/`), 'public photo URLs never expire');
const followed = await fetch(stable);
assert.equal(followed.headers.get('content-type'), 'image/webp');
ok('stable photo URL → 302 → MinIO', new URL(stable).pathname);

console.log(`\nAll live checks passed. Public slug: ${slug}`);
if (!process.env.KEEP_RUNNING) console.log('Services are still running; stop them with: docker compose --profile apps stop');
