import assert from 'node:assert/strict';
import test from 'node:test';
import { JwksJwtValidator, JwtGuard, UnauthorizedError, currentTenant, expectCrossTenantNotFound, runWithTenant, tenantFromRequest } from '../dist/index.js';

const token = (header, claims) => `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;

test('rejects an invalid signature and accepts a cached JWKS key', async () => {
  let fetches = 0;
  const validator = new JwksJwtValidator({ fetch: async () => { fetches += 1; return { keys: [{ kid: 'key-1', kty: 'RSA' }] }; } }, { verify: async (_token, key) => key.kid === 'key-1' }, () => 100);
  const good = token({ kid: 'key-1' }, { sub: 'user-1', exp: 200, celebrationId: 'cel-1' });
  assert.equal((await new JwtGuard(validator).authenticate(`Bearer ${good}`)).sub, 'user-1');
  await new JwtGuard(validator).authenticate(`Bearer ${good}`);
  assert.equal(fetches, 1);
  const bad = token({ kid: 'other' }, { sub: 'user-1', exp: 200 });
  await assert.rejects(validator.validate(bad), UnauthorizedError);
});

test('keeps concurrent tenant contexts isolated', async () => {
  const values = await Promise.all(['cel-a', 'cel-b'].map((celebrationId) => runWithTenant({ celebrationId }, async () => { await Promise.resolve(); return currentTenant().celebrationId; })));
  assert.deepEqual(values, ['cel-a', 'cel-b']);
  assert.throws(() => tenantFromRequest({ celebrationId: 'cel-a' }, { sub: 'u', exp: 200, celebrationId: 'cel-b' }));
});

test('offers a three-line cross-tenant assertion helper', async () => {
  await expectCrossTenantNotFound(async () => ({ status: 404 }));
  await assert.rejects(expectCrossTenantNotFound(async () => ({ status: 403 })));
});
