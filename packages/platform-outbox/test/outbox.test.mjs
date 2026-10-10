import assert from 'node:assert/strict';
import test from 'node:test';
import { CLAIM_OUTBOX_SQL, InMemoryInboxRepository, InMemoryOutboxRepository, OutboxRelay, consumeOnce, enqueueInTransaction } from '../dist/index.js';

const event = { id: 'evt-1', aggregateType: 'Gift', aggregateId: 'gift-1', eventName: 'gift-list.gift.created.v1', payload: {}, correlationId: 'corr-1', tenantId: 'cel-1' };

test('commits the outbox only when the aggregate transaction succeeds', async () => {
  const repository = new InMemoryOutboxRepository();
  await assert.rejects(repository.transaction(async (tx) => { await enqueueInTransaction(tx, event); throw new Error('rollback'); }));
  assert.equal(repository.snapshot().length, 0);
  await repository.transaction((tx) => enqueueInTransaction(tx, event));
  assert.equal(repository.snapshot().length, 1);
  assert.match(CLAIM_OUTBOX_SQL, /FOR UPDATE SKIP LOCKED/);
});

test('replays retained events after a publisher outage', async () => {
  const repository = new InMemoryOutboxRepository();
  await repository.transaction((tx) => enqueueInTransaction(tx, event));
  let live = false;
  let clock = new Date('2026-01-01T00:10:00Z');
  const relay = new OutboxRelay(repository, { publish: async () => { if (!live) throw new Error('broker offline'); } }, 3, () => clock);
  assert.deepEqual(await relay.relayBatch(), { published: 0, failed: 1 });
  live = true;
  clock = new Date('2026-01-01T00:10:01Z');
  assert.deepEqual(await relay.relayBatch(), { published: 1, failed: 0 });
  assert.equal(repository.snapshot()[0].status, 'PUBLISHED');
});

test('inbox performs exactly one effect for duplicate delivery', async () => {
  const inbox = new InMemoryInboxRepository();
  let effects = 0;
  await Promise.all([consumeOnce(inbox, 'event-1', async () => { effects += 1; }), consumeOnce(inbox, 'event-1', async () => { effects += 1; }), consumeOnce(inbox, 'event-1', async () => { effects += 1; })]);
  assert.equal(effects, 1);
});

test('two relays do not claim the same event', async () => {
  const repository = new InMemoryOutboxRepository();
  await repository.transaction((tx) => enqueueInTransaction(tx, event));
  const [first, second] = await Promise.all([repository.claim(10, new Date()), repository.claim(10, new Date())]);
  assert.equal(first.length + second.length, 1);
});
