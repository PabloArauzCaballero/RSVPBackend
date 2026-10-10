import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfirmingPublisher, ManualAckConsumer, RETRY_DELAYS_MS, assertEnvelope, assertRoutingKey } from '../dist/index.js';

const event = { eventId: 'evt-1', eventName: 'guest-rsvp.rsvp.confirmed.v1', occurredAt: new Date().toISOString(), correlationId: 'corr-1', tenant: { celebrationId: 'cel-1' }, payload: {} };

test('validates the routing key and required envelope fields', () => {
  assert.doesNotThrow(() => assertEnvelope(event));
  assert.throws(() => assertRoutingKey('bad-name'));
  assert.throws(() => assertEnvelope({ ...event, correlationId: '' }));
});

test('waits for broker confirms', async () => {
  let confirmed = false;
  const publisher = new ConfirmingPublisher({ publish: () => true, waitForConfirms: async () => { confirmed = true; } });
  await publisher.publish('guest-rsvp.events', event);
  assert.equal(confirmed, true);
});

test('retries four times and parks on the fifth failure', async () => {
  const retries = [];
  let parked = false;
  const consumer = new ManualAckConsumer({ ack() {}, retry: async (_delivery, delay) => retries.push(delay), park: async () => { parked = true; } }, async () => { throw new Error('nope'); });
  for (let attempts = 0; attempts < 5; attempts += 1) await consumer.consume({ content: new TextEncoder().encode(JSON.stringify(event)), headers: { 'x-rsvp-attempt': attempts } });
  assert.deepEqual(retries, [...RETRY_DELAYS_MS]);
  assert.equal(parked, true);
});
