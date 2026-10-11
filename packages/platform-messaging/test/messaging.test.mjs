import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfirmingPublisher, ManualAckConsumer, RETRY_DELAYS_MS, assertEnvelope, assertRoutingKey, createRabbitMqDeliveryChannel, declareTopology } from '../dist/index.js';

const event = { eventId: 'evt-1', eventName: 'guest-rsvp.rsvp.confirmed.v1', occurredAt: new Date().toISOString(), correlationId: 'corr-1', tenant: { celebrationId: 'cel-1' }, payload: {} };

test('validates the routing key and required envelope fields', () => {
  assert.doesNotThrow(() => assertEnvelope(event));
  assert.throws(() => assertRoutingKey('bad-name'));
  assert.throws(() => assertEnvelope({ ...event, correlationId: '' }));
  assert.throws(() => assertEnvelope({ ...event, payload: undefined }));
  const withoutPayload = { ...event };
  delete withoutPayload.payload;
  assert.throws(() => assertEnvelope(withoutPayload));
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

test('declares durable event, retry and parking topology idempotently', async () => {
  const exchanges = [];
  const queues = [];
  const bindings = [];
  const channel = {
    assertExchange: async (name) => exchanges.push(name),
    assertQueue: async (name, options) => queues.push({ name, options }),
    bindQueue: async (...binding) => bindings.push(binding)
  };
  await declareTopology(channel, [{ context: 'guest-rsvp', consumer: 'projection', pattern: 'guest-rsvp.#' }]);
  assert.equal(exchanges.length, 42);
  assert.ok(queues.some(({ name }) => name === 'guest-rsvp.retry.5000'));
  assert.ok(queues.some(({ name, options }) => name === 'guest-rsvp.retry.600000' && options.arguments['x-dead-letter-exchange'] === 'guest-rsvp.events'));
  assert.ok(bindings.some(([queue, exchange]) => queue === 'guest-rsvp.parking' && exchange === 'guest-rsvp.parking'));
  await assert.rejects(() => declareTopology(channel, [{ context: 'unknown', consumer: 'projection', pattern: '#' }]));
});

test('confirms retry publication before acknowledging the original delivery', async () => {
  const calls = [];
  const delivery = { content: new TextEncoder().encode(JSON.stringify(event)), headers: {} };
  const channel = {
    ack: () => calls.push('ack'),
    publish: (exchange, routingKey, _content, options) => { calls.push({ exchange, routingKey, headers: options.headers }); return true; },
    waitForConfirms: async () => { calls.push('confirmed'); }
  };
  await createRabbitMqDeliveryChannel(channel, 'guest-rsvp').retry(delivery, 5_000, 'transient');
  assert.deepEqual(calls, [{ exchange: 'guest-rsvp.retry.5000', routingKey: event.eventName, headers: { 'x-rsvp-reason': 'transient', 'x-rsvp-attempt': 1 } }, 'confirmed', 'ack']);
});
