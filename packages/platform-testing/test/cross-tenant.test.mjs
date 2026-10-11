import assert from 'node:assert/strict';
import test from 'node:test';
import { expectCrossTenantNotFound } from '../dist/index.js';

test('accepts the safe cross-tenant response', async () => {
  await expectCrossTenantNotFound(async () => ({ status: 404 }));
});

test('rejects a response that leaks resource existence', async () => {
  await assert.rejects(expectCrossTenantNotFound(async () => ({ status: 403 })), /expected 404/);
});
