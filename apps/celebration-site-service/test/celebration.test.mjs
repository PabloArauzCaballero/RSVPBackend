import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { celebrationApplication, buildRuntime, recordTemplateReference } from '../dist/index.js';
import { ALL_SEEDS, weddingContent } from './support.mjs';

/** The use-case facade, without HTTP: what a script or another adapter would call. */
test('the application facade drives a celebration through its whole life', async () => {
  const runtime = await buildRuntime({ seeds: ALL_SEEDS, authenticator: { authenticate: async () => { throw new Error('unused'); } } });
  const app = celebrationApplication(runtime.app);
  const owner = { actor: { userId: randomUUID(), roles: [], organizationIds: [] }, correlationId: randomUUID() };
  const coHost = randomUUID();
  const template = randomUUID();
  await recordTemplateReference(runtime.app, { templateId: template, tags: ['wedding'], status: 'PUBLISHED' });

  const created = await app.create(owner, { slug: 'fachada-boda', eventTypeCode: 'WEDDING', content: weddingContent });
  let state = await app.edit(owner, { celebrationId: created.id, expectedVersion: created.version, patch: { content: { story: 'Historia' } } });
  state = await app.setCollaborator(owner, { celebrationId: state.id, expectedVersion: state.version, userId: coHost, role: 'CO_HOST' });
  state = await app.updateSettings(owner, { celebrationId: state.id, expectedVersion: state.version, patch: { giftReservationMode: 'AUTO_ACCEPT' } });
  state = await app.selectTemplate(owner, { celebrationId: state.id, expectedVersion: state.version, templateId: template });
  assert.deepEqual(await app.publishCheck(owner, state.id), { ready: true, missingFields: [], status: 'DRAFT', version: state.version });
  state = await app.publish(owner, { celebrationId: state.id, expectedVersion: state.version });
  state = await app.unpublish(owner, { celebrationId: state.id, expectedVersion: state.version, reason: null });
  state = await app.assignType(owner, { celebrationId: state.id, expectedVersion: state.version, eventTypeCode: 'ANNIVERSARY' });
  state = await app.archive(owner, { celebrationId: state.id, expectedVersion: state.version });
  assert.equal(state.status, 'ARCHIVED');

  const view = await app.get(owner, state.id);
  assert.equal(view.access, 'MANAGE');
  assert.equal((await app.list(owner, { limit: 10, offset: 0 })).length, 1);
  assert.deepEqual((await app.audit(owner, state.id)).map((entry) => entry.action),
    ['CREATED', 'CONFIGURED', 'CONFIGURED', 'SETTINGS_UPDATED', 'TEMPLATE_SELECTED', 'PUBLISHED', 'UNPUBLISHED', 'TYPE_ASSIGNED', 'ARCHIVED']);
  assert.equal((await app.eventTypes('en-US')).find((type) => type.code === 'BAUTIZO').name, 'Baptism');
  assert.equal((await app.eventType('CORPORATE')).name, 'Evento corporativo');

  const admin = { actor: { userId: randomUUID(), roles: ['ADMIN'], organizationIds: [] }, correlationId: randomUUID() };
  const definition = { ...ALL_SEEDS[0], code: 'WEDDING_CIVIL' };
  assert.equal((await app.upsertEventType(admin, definition)).created, true);
  await runtime.close();
});
