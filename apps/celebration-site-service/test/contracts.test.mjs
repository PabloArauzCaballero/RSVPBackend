import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { start, settle, tokenFor, user, createWedding } from './support.mjs';
import { validateEvent, validate, asyncapi } from './json-schema.mjs';
import { recordTemplateReference, buildEnvelope } from '../dist/index.js';
import { GiftListService, InMemoryGiftItemRepository, createCatalogedGift, Money as GiftMoney } from '../../gift-list-service/dist/index.js';
import { resolveCompanions, confirmUnregistered } from '../../guest-rsvp-service/src/index.mjs';

let server;
let events;
const host = user();
const token = tokenFor(host);

/** Drives one celebration through every event this service produces. */
before(async () => {
  server = await start();
  const template = randomUUID();
  await recordTemplateReference(server.runtime.app, { templateId: template, tags: ['wedding'], status: 'PUBLISHED' });
  const c = await createWedding(server.api, token);
  const id = c.id;
  let version = 1;
  const step = async (method, path, body) => {
    const response = await server.api(method, `/celebrations/${id}${path}`, { token, ifMatch: version, body });
    assert.ok(response.status < 300, `${method} ${path} → ${response.status} ${JSON.stringify(response.body)}`);
    version = response.body.version;
  };
  await step('PATCH', '', { content: { story: 'Nos conocimos en La Paz' } });
  await step('PUT', '/settings', { giftReservationMode: 'AUTO_ACCEPT', extraCompanionMode: 'AUTO_ACCEPT', unregisteredRsvpMode: 'AUTO_ACCEPT' });
  await step('PUT', '/template', { templateId: template });
  await step('POST', '/publish');
  await step('POST', '/unpublish', { reason: 'Cambio de fecha' });
  await step('PUT', '/event-type', { eventTypeCode: 'QUINCEANERA' });
  await step('POST', '/archive');
  await settle();
  events = server.runtime.memory.outboxSnapshot().filter((event) => event.tenant.celebrationId === id);
});
after(async () => { await server.close(); });

test('every event type of this service is produced and has a channel in the catalog', () => {
  const produced = new Set(events.map((event) => event.eventType));
  const ours = Object.keys(asyncapi.channels).filter((channel) => channel.startsWith('celebration.'));
  assert.deepEqual([...produced].sort(), ours.sort());
});

test('REQ-12-02 / REQ-13-03 · every envelope and payload validates against the AsyncAPI schema, field by field', () => {
  for (const event of events) assert.deepEqual(validateEvent(event), [], event.eventType);
});

test('the validator itself rejects a wrong envelope (the contract test can fail)', () => {
  const [first] = events;
  const broken = { ...first, eventVersion: 2, tenant: { celebrationId: 'nope' }, payload: { ...first.payload, unexpected: true } };
  const errors = validateEvent(broken);
  assert.ok(errors.some((error) => error.includes('eventVersion')));
  assert.ok(errors.some((error) => error.includes('tenant.celebrationId')));
  assert.ok(errors.some((error) => error.includes('unexpected')));
  assert.deepEqual(validate({ type: 'string', format: 'uuid' }, randomUUID()), []);
});

function pythonEnvelope() {
  const script = fileURLToPath(new URL('./fixtures/python-envelope.py', import.meta.url));
  const serviceDir = fileURLToPath(new URL('../../template-media-service', import.meta.url));
  const candidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  for (const command of candidates) {
    try { return JSON.parse(execFileSync(command, [script, serviceDir], { encoding: 'utf8' })); } catch { /* try the next interpreter name */ }
  }
  throw new Error('No python interpreter available');
}

const shape = (value) => {
  if (value === null) return 'null|string';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, shape(value[key])]));
  return typeof value === 'string' ? 'null|string' : typeof value;
};

test('REQ-16-06 · the Django envelope is identical, field by field, to the NestJS one', () => {
  const fromPython = pythonEnvelope();
  const fromNode = buildEnvelope({ eventId: randomUUID(), eventType: 'template.media.uploaded.v1', occurredAt: new Date().toISOString(), correlationId: randomUUID(), celebrationId: randomUUID(), organizationId: null, actorId: randomUUID(), payload: {} });
  const strip = ({ payload, producer, ...rest }) => rest;
  assert.deepEqual(shape(strip(fromPython)), shape(strip(fromNode)));
  assert.equal(fromPython.producer, 'template-media-service');
  assert.deepEqual(validateEvent(fromPython), []);
});

test('REQ-12-04 · Gift List: 3 pending reservations stay pending after the real AUTO_ACCEPT event; only new ones auto-commit', () => {
  const settings = events.find((event) => event.eventType === 'celebration.settings.updated.v1');
  const celebrationId = settings.tenant.celebrationId;
  const gifts = new GiftListService(new InMemoryGiftItemRepository());
  gifts.createList('list', celebrationId);
  for (const n of [1, 2, 3, 4]) gifts.add(createCatalogedGift({ id: `gift-${n}`, listId: 'list', title: `Regalo ${n}`, price: GiftMoney.of(10000, 'BOB'), catalog: { productListingId: `p${n}`, providerVerified: true } }));
  const pending = [1, 2, 3].map((n) => gifts.requestReservation(`r${n}`, `gift-${n}`, `guest-${n}`, celebrationId));
  assert.deepEqual(pending.map((r) => r.status), ['PENDING_REVIEW', 'PENDING_REVIEW', 'PENDING_REVIEW']);
  // The consumer maps the contract payload; applying the same envelope twice is a no-op.
  gifts.applySettings(settings.eventId, celebrationId, settings.payload.giftReservationMode);
  gifts.applySettings(settings.eventId, celebrationId, settings.payload.giftReservationMode);
  assert.deepEqual([...gifts.reservations.values()].filter((r) => r.id !== 'r4').map((r) => r.status), ['PENDING_REVIEW', 'PENDING_REVIEW', 'PENDING_REVIEW']);
  assert.equal(gifts.requestReservation('r4', 'gift-4', 'guest-4', celebrationId).status, 'COMMITTED');
});

test('REQ-12-04 · Guest/RSVP: a companion request raised under RESTRICTED stays pending; the new mode applies to new requests', () => {
  const settings = events.find((event) => event.eventType === 'celebration.settings.updated.v1').payload;
  const raisedBefore = resolveCompanions({ requested: 3, allowed: 1, mode: 'RESTRICTED' });
  assert.equal(raisedBefore.request.status, 'PENDING_REVIEW');
  const raisedAfter = resolveCompanions({ requested: 3, allowed: 1, mode: settings.extraCompanionMode });
  assert.equal(raisedAfter.approved, 3);
  assert.equal(raisedBefore.request.status, 'PENDING_REVIEW', 'the earlier request is untouched');
  assert.equal(confirmUnregistered({ mode: settings.unregisteredRsvpMode, createGuest: () => 'guest' }), 'guest');
  assert.ok(Date.parse(settings.effectiveFrom) > 0);
});
