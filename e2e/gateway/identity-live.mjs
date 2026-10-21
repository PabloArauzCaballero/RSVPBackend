// Live check of lane 07 (Pablo) through Kong, against the running compose stack.
// A user registers and logs in on the real Identity service; Celebration (lane 10) validates that
// token against Identity's JWKS, with no static key. Then refresh, reuse and logout are exercised.
//   node e2e/gateway/identity-live.mjs
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../..', import.meta.url));
const gateway = process.env.GATEWAY_URL ?? 'http://localhost:8000';
const step = (label) => console.log(`\n▶ ${label}`);
const ok = (label, detail = '') => console.log(`  ✔ ${label}${detail ? ` — ${detail}` : ''}`);

step('docker compose --profile apps up (identity + celebration + kong)');
// IDENTITY_JWKS_JSON is forced empty so Celebration must fetch the real JWKS from Identity.
const up = spawnSync('docker', ['compose', '--profile', 'apps', 'up', '-d', '--build', '--wait', 'identity-service', 'celebration-site-service', 'kong'],
  { cwd: root, env: { ...process.env, IDENTITY_JWKS_JSON: '' }, stdio: 'inherit' });
assert.equal(up.status, 0, 'compose up failed');

const call = async (method, path, { token, body, headers = {} } = {}) => {
  const response = await fetch(`${gateway}${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : undefined };
};
const eventually = async (label, probe, timeoutMs = 90_000) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await probe().catch(() => false)) return;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};
const claims = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

step('health and JWKS through Kong');
await eventually('identity health', async () => (await call('GET', '/identity/health')).status === 200);
await eventually('celebration health', async () => (await call('GET', '/celebrations/health')).status === 200);
const jwks = await call('GET', '/identity/.well-known/jwks.json');
assert.equal(jwks.status, 200);
assert.equal(jwks.body.keys[0].alg, 'RS256');
assert.equal(jwks.body.keys[0].d, undefined, 'private key material must never be published');
ok('GET /identity/.well-known/jwks.json → 200', `kid ${jwks.body.keys[0].kid}`);

step('register and log in');
const email = `live-${randomUUID().slice(0, 8)}@example.test`;
const password = 'una frase larga de prueba';
const registered = await call('POST', '/identity/auth/register', { body: { email, password }, headers: { 'x-correlation-id': `identity-live-${randomUUID()}` } });
assert.equal(registered.status, 201, JSON.stringify(registered.body));
assert.equal(typeof registered.body.accessToken, 'string', 'sign-up returns a session (frontend IdentityClient.register)');
assert.equal(registered.body.expiresIn, 900);
ok('POST /identity/auth/register → 201 with session', `roles ${registered.body.roles}`);
assert.equal((await call('POST', '/identity/auth/register', { body: { email: `admin-${email}`, password, role: 'ADMIN' } })).status, 422);
ok('self-service ADMIN → 422');
assert.equal((await call('POST', '/identity/auth/register', { body: { email: email.toUpperCase(), password } })).status, 409);
ok('same e-mail in upper case → 409');
const weak = await call('POST', '/identity/auth/register', { body: { email: `x-${email}`, password: 'corta' } });
assert.equal(weak.status, 422);
assert.match(weak.headers.get('content-type') ?? '', /application\/problem\+json/);
ok('short password → 422 problem+json');
assert.equal((await call('POST', '/identity/auth/login', { body: { email, password: 'otra frase equivocada' } })).status, 401);
ok('wrong password → 401');

const login = await call('POST', '/identity/auth/login', { body: { email, password } });
assert.equal(login.status, 200);
const access = login.body.accessToken;
const tokenClaims = claims(access);
assert.equal(tokenClaims.sub, registered.body.id);
assert.deepEqual(tokenClaims.roles, ['HOST']);
assert.deepEqual(tokenClaims.organizationIds, []);
assert.equal(tokenClaims.exp - tokenClaims.iat, 900);
ok('POST /identity/auth/login → 200', `claims sub, roles ${JSON.stringify(tokenClaims.roles)}, organizationIds [], 15 min`);

step('the Identity token opens Celebration (JWKS fetched from Identity)');
assert.equal((await call('POST', '/celebrations', { body: { slug: 'x', eventTypeCode: 'WEDDING' } })).status, 401);
ok('no token → 401');
const slug = `boda-identity-${randomUUID().slice(0, 8)}`;
const created = await call('POST', '/celebrations', { token: access, body: { slug, eventTypeCode: 'WEDDING', supportedLocales: ['es-BO'], content: { title: 'Ana y Luis', eventDate: '2026-12-19T19:00', venueName: 'Hacienda El Prado', hosts: { BRIDE: 'Ana', GROOM: 'Luis' } } } });
assert.equal(created.status, 201, JSON.stringify(created.body));
ok('POST /celebrations with Identity token → 201', `id ${created.body.id}`);
assert.equal((await call('GET', `/celebrations/${created.body.id}`, { token: access })).status, 200);
ok('owner reads it → 200');
const sig = access.lastIndexOf('.') + 1;
const tampered = access.slice(0, sig) + (access[sig] === 'A' ? 'B' : 'A') + access.slice(sig + 1);
assert.equal((await call('GET', `/celebrations/${created.body.id}`, { token: tampered })).status, 401);
ok('one changed signature byte → 401');

const other = `other-${randomUUID().slice(0, 8)}@example.test`;
await call('POST', '/identity/auth/register', { body: { email: other, password } });
const otherToken = (await call('POST', '/identity/auth/login', { body: { email: other, password } })).body.accessToken;
assert.equal((await call('GET', `/celebrations/${created.body.id}`, { token: otherToken })).status, 404);
ok('another real user → 404 (tenant isolation)');

step('refresh rotation, reuse detection and logout');
const rotated = await call('POST', '/identity/auth/refresh', { body: { refreshToken: login.body.refreshToken } });
assert.equal(rotated.status, 200);
ok('refresh → 200, new refresh token');
assert.equal((await call('POST', '/identity/auth/refresh', { body: { refreshToken: login.body.refreshToken } })).status, 401);
assert.equal((await call('POST', '/identity/auth/refresh', { body: { refreshToken: rotated.body.refreshToken } })).status, 401);
ok('reusing the old token → 401 and the whole chain is revoked');
const second = (await call('POST', '/identity/auth/login', { body: { email, password } })).body.refreshToken;
assert.equal((await call('POST', '/identity/auth/logout', { body: { refreshToken: second } })).status, 204);
assert.equal((await call('POST', '/identity/auth/refresh', { body: { refreshToken: second } })).status, 401);
ok('logout → 204, then refresh → 401');

console.log('\nIdentity live check passed.');
