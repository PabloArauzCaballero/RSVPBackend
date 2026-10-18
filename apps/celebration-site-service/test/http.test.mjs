import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { start, settle, sign, tokenFor, user, createWedding, weddingContent, ALL_SEEDS } from './support.mjs';
import { seedEventTypes, readSeedFile, SEEDS_DIR } from '../dist/index.js';
import { join } from 'node:path';

let server;
before(async () => { server = await start(); });
after(async () => { await server.close(); });

const host = user();
const hostToken = tokenFor(host);
const stranger = tokenFor(user());

test('health and readiness need no token', async () => {
  assert.equal((await server.api('GET', '/celebrations/health')).status, 200);
  assert.equal((await server.api('GET', '/celebrations/ready')).body.status, 'ready');
  assert.equal((await server.api('GET', '/nothing-here')).status, 404);
});

test('401 without, with a forged, an expired or a non-RS256 token', async () => {
  assert.equal((await server.api('GET', '/celebrations')).status, 401);
  assert.equal((await server.api('GET', '/celebrations', { token: 'a.b.c' })).status, 401);
  assert.equal((await server.api('GET', '/celebrations', { token: sign(user(), { expiresIn: -10 }) })).status, 401);
  const forged = `${hostToken.split('.').slice(0, 2).join('.')}.${Buffer.from('nope').toString('base64url')}`;
  assert.equal((await server.api('GET', '/celebrations', { token: forged })).status, 401);
  const [, payload, signature] = hostToken.split('.');
  const hs = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: 'test-key-1' })).toString('base64url')}.${payload}.${signature}`;
  const response = await server.api('GET', '/celebrations', { token: hs });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('www-authenticate'), 'Bearer');
  assert.equal(response.headers.get('content-type'), 'application/problem+json');
});

test('REQ-10 · create returns 201 with Location, ETag and safe defaults; 400 and 422 are distinct', async () => {
  const response = await server.api('POST', '/celebrations', { token: hostToken, body: { slug: `boda-${randomUUID().slice(0, 6)}`, eventTypeCode: 'WEDDING', content: weddingContent } });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('location'), `/celebrations/${response.body.id}`);
  assert.equal(response.headers.get('etag'), '"1"');
  assert.equal(response.body.status, 'DRAFT');
  assert.equal(response.body.settings.giftReservationMode, 'RESTRICTED');
  assert.equal(response.body.currency, 'BOB');
  assert.equal(response.body.timeZone, 'America/La_Paz');
  assert.equal(response.body.content.eventDate, '2026-12-19T23:00:00.000Z', '19:00 in La Paz');
  assert.equal(response.body.ownerId, host.sub);

  const unknownKey = await server.api('POST', '/celebrations', { token: hostToken, body: { slug: 'x-y-z', eventTypeCode: 'WEDDING', colour: 'red' } });
  assert.equal(unknownKey.status, 400);
  assert.equal(unknownKey.body.code, 'BAD_REQUEST');
  assert.equal((await server.api('POST', '/celebrations', { token: hostToken, raw: '{not json' })).status, 400);
  assert.equal((await server.api('POST', '/celebrations', { token: hostToken, body: { slug: 'Bad Slug', eventTypeCode: 'WEDDING' } })).status, 422);
  assert.equal((await server.api('POST', '/celebrations', { token: hostToken, body: { slug: 'tipo-raro', eventTypeCode: 'UNKNOWN' } })).body.code, 'UNKNOWN_EVENT_TYPE');
  const textPlain = await fetch(`${server.base}/celebrations`, { method: 'POST', headers: { authorization: `Bearer ${hostToken}`, 'content-type': 'text/plain' }, body: '{}' });
  assert.equal(textPlain.status, 415);
});

test('REQ-13-06 · a slug used by any tenant answers 409', async () => {
  const slug = `unica-${randomUUID().slice(0, 6)}`;
  assert.equal((await server.api('POST', '/celebrations', { token: hostToken, body: { slug, eventTypeCode: 'WEDDING' } })).status, 201);
  const other = await server.api('POST', '/celebrations', { token: stranger, body: { slug, eventTypeCode: 'WEDDING' } });
  assert.equal(other.status, 409);
  assert.equal(other.body.code, 'SLUG_TAKEN');
});

test('REQ-10-06 · every celebration endpoint answers 404 to a stranger, never 403, and never leaks data', async () => {
  const celebration = await createWedding(server.api, hostToken);
  const id = celebration.id;
  const probes = [
    ['GET', `/celebrations/${id}`], ['PATCH', `/celebrations/${id}`, { content: { title: 'hack' } }], ['GET', `/celebrations/${id}/settings`],
    ['PUT', `/celebrations/${id}/settings`, { giftReservationMode: 'AUTO_ACCEPT' }], ['PUT', `/celebrations/${id}/event-type`, { eventTypeCode: 'QUINCEANERA' }],
    ['PUT', `/celebrations/${id}/template`, { templateId: randomUUID() }], ['PUT', `/celebrations/${id}/collaborators/${randomUUID()}`, { role: 'VIEWER' }],
    ['DELETE', `/celebrations/${id}/collaborators/${randomUUID()}`], ['GET', `/celebrations/${id}/publish-check`], ['POST', `/celebrations/${id}/publish`],
    ['POST', `/celebrations/${id}/unpublish`], ['POST', `/celebrations/${id}/archive`], ['GET', `/celebrations/${id}/audit`]
  ];
  for (const [method, path, body] of probes) {
    const response = await server.api(method, path, { token: stranger, body, ifMatch: 1 });
    assert.equal(response.status, 404, `${method} ${path}`);
    assert.equal(JSON.stringify(response.body).includes('Ana'), false);
  }
  const list = await server.api('GET', '/celebrations', { token: stranger });
  assert.equal(list.body.items.some((item) => item.id === id), false);
  assert.equal((await server.api('GET', '/celebrations/not-a-uuid', { token: hostToken })).status, 404);
  assert.equal((await server.api('GET', `/celebrations/${randomUUID()}`, { token: hostToken })).status, 404);
  assert.equal((await server.api('GET', `/celebrations/${id}`, { token: hostToken })).status, 200);
});

test('REQ-10-05 · a planner sees the celebrations of their organization and none other', async () => {
  const orgA = randomUUID();
  const orgB = randomUUID();
  const plannerA = tokenFor(user({ roles: ['PLANNER'], organizationIds: [orgA] }));
  const plannerB = tokenFor(user({ roles: ['PLANNER'], organizationIds: [orgB] }));
  const ownerInA = tokenFor(user({ organizationIds: [orgA] }));
  const forbiddenOrg = await server.api('POST', '/celebrations', { token: hostToken, body: { slug: `org-${randomUUID().slice(0, 6)}`, eventTypeCode: 'WEDDING', organizationId: orgA } });
  assert.equal(forbiddenOrg.status, 403);
  const inA = await createWedding(server.api, ownerInA, { organizationId: orgA });
  assert.equal((await server.api('GET', `/celebrations/${inA.id}`, { token: plannerA })).body.access, 'MANAGE');
  assert.equal((await server.api('GET', `/celebrations/${inA.id}`, { token: plannerB })).status, 404);
  const listA = await server.api('GET', '/celebrations', { token: plannerA });
  assert.deepEqual(listA.body.items.map((item) => item.id), [inA.id]);
  assert.deepEqual((await server.api('GET', '/celebrations', { token: plannerB })).body.items, []);
});

test('REQ-12-05 · host 200, organization planner 200, read-only member 403 on settings', async () => {
  const org = randomUUID();
  const owner = tokenFor(user({ organizationIds: [org] }));
  const planner = tokenFor(user({ roles: ['PLANNER'], organizationIds: [org] }));
  const member = tokenFor(user({ organizationIds: [org] }));
  const c = await createWedding(server.api, owner, { organizationId: org });
  const byHost = await server.api('PUT', `/celebrations/${c.id}/settings`, { token: owner, ifMatch: 1, body: { giftReservationMode: 'AUTO_ACCEPT' } });
  assert.equal(byHost.status, 200);
  const byPlanner = await server.api('PUT', `/celebrations/${c.id}/settings`, { token: planner, ifMatch: 2, body: { externalGiftMode: 'AUTO_ACCEPT' } });
  assert.equal(byPlanner.status, 200);
  assert.equal(byPlanner.headers.get('etag'), '"3"');
  const byMember = await server.api('PUT', `/celebrations/${c.id}/settings`, { token: member, ifMatch: 3, body: { extraCompanionMode: 'AUTO_ACCEPT' } });
  assert.equal(byMember.status, 403);
  assert.equal((await server.api('GET', `/celebrations/${c.id}/settings`, { token: member })).body.extraCompanionMode, 'RESTRICTED');
  const badBody = await server.api('PUT', `/celebrations/${c.id}/settings`, { token: owner, ifMatch: 3, body: {} });
  assert.equal(badBody.status, 400);
});

test('REQ-10-04 · two concurrent edits of the same version: exactly one wins, the other gets 409', async () => {
  const c = await createWedding(server.api, hostToken);
  const results = await Promise.all(['Primera', 'Segunda'].map((title) => server.api('PATCH', `/celebrations/${c.id}`, { token: hostToken, ifMatch: 1, body: { content: { title } } })));
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(results.find((r) => r.status === 409).body.code, 'VERSION_CONFLICT');
  assert.equal((await server.api('PATCH', `/celebrations/${c.id}`, { token: hostToken, body: { content: { title: 'x' } } })).status, 428);
});

test('REQ-13 · publish 422 lists the missing fields; complete → 200; unpublish is audited; archived is terminal', async () => {
  const c = await createWedding(server.api, hostToken, { content: { title: 'Sin fecha', hosts: { BRIDE: 'Ana', GROOM: 'Luis' }, venueName: 'Salón' } });
  const check = await server.api('GET', `/celebrations/${c.id}/publish-check`, { token: hostToken });
  assert.deepEqual(check.body, { ready: false, missingFields: ['eventDate'], status: 'DRAFT', version: 1 });
  const rejected = await server.api('POST', `/celebrations/${c.id}/publish`, { token: hostToken, ifMatch: 1 });
  assert.equal(rejected.status, 422);
  assert.deepEqual(rejected.body.missingFields, ['eventDate']);
  const edited = await server.api('PATCH', `/celebrations/${c.id}`, { token: hostToken, ifMatch: 1, body: { content: { eventDate: '2026-12-19T19:00' } } });
  const published = await server.api('POST', `/celebrations/${c.id}/publish`, { token: hostToken, ifMatch: edited.body.version });
  assert.equal(published.status, 200);
  assert.equal(published.body.status, 'PUBLISHED');
  const unpublished = await server.api('POST', `/celebrations/${c.id}/unpublish`, { token: hostToken, ifMatch: published.body.version, body: { reason: 'Cambio de salón' } });
  assert.equal(unpublished.body.status, 'DRAFT');
  const audit = await server.api('GET', `/celebrations/${c.id}/audit`, { token: hostToken });
  const entry = audit.body.items.find((item) => item.action === 'UNPUBLISHED');
  assert.equal(entry.actorId, host.sub);
  assert.equal(entry.details.reason, 'Cambio de salón');
  assert.ok(Date.parse(entry.at));
  const archived = await server.api('POST', `/celebrations/${c.id}/archive`, { token: hostToken, ifMatch: unpublished.body.version });
  assert.equal(archived.body.status, 'ARCHIVED');
  const again = await server.api('POST', `/celebrations/${c.id}/publish`, { token: hostToken, ifMatch: archived.body.version });
  assert.equal(again.status, 409);
});

test('REQ-13-03 / REQ-12-02 · published and settings events leave by the outbox with the contract envelope', async () => {
  const c = await createWedding(server.api, hostToken);
  const settings = await server.api('PUT', `/celebrations/${c.id}/settings`, { token: hostToken, ifMatch: 1, body: { unregisteredRsvpMode: 'AUTO_ACCEPT', rsvpDeadline: 'el viernes' } });
  assert.equal(settings.status, 422);
  assert.equal(settings.body.code, 'INVALID_RSVP_DEADLINE');
  const ok = await server.api('PUT', `/celebrations/${c.id}/settings`, { token: hostToken, ifMatch: 1, body: { unregisteredRsvpMode: 'AUTO_ACCEPT', rsvpDeadline: '2026-12-10T23:59' } });
  assert.equal(ok.status, 200);
  await server.api('POST', `/celebrations/${c.id}/publish`, { token: hostToken, ifMatch: 2, headers: { 'x-correlation-id': '0b6f8c1e-2a1d-4c5e-9f00-1234567890ab' } });
  const events = server.runtime.memory.outboxSnapshot().filter((event) => event.tenant.celebrationId === c.id);
  assert.deepEqual(events.map((event) => event.eventType), ['celebration.celebration.created.v1', 'celebration.settings.updated.v1', 'celebration.celebration.published.v1']);
  const published = events.at(-1);
  assert.equal(published.correlationId, '0b6f8c1e-2a1d-4c5e-9f00-1234567890ab');
  assert.deepEqual(published.actor, { type: 'USER', id: host.sub });
  assert.equal(published.producer, 'celebration-site-service');
  assert.equal(published.payload.settings.unregisteredRsvpMode, 'AUTO_ACCEPT');
  assert.equal(events[1].payload.rsvpDeadline, '2026-12-11T03:59:00.000Z');
  assert.equal(new Set(events.map((event) => event.eventId)).size, 3);
});

test('REQ-15 · the public page appears on publish, answers in one read in any locale, and disappears on unpublish', async () => {
  const c = await createWedding(server.api, hostToken, { supportedLocales: ['es-BO', 'en-US'], translations: { 'en-US': { title: 'Ana & Luis' } } });
  assert.equal((await server.api('GET', `/celebrations/public/${c.slug}`)).status, 404, 'draft is not public');
  const published = await server.api('POST', `/celebrations/${c.id}/publish`, { token: hostToken, ifMatch: 1 });
  await settle();
  const es = await server.api('GET', `/celebrations/public/${c.slug}`);
  assert.equal(es.status, 200);
  assert.equal(es.body.content.title, 'Ana y Luis');
  assert.equal(es.body.eventType.name, 'Boda');
  assert.equal(es.headers.get('content-language'), 'es-BO');
  assert.match(es.headers.get('cache-control'), /public/);
  const en = await server.api('GET', `/celebrations/public/${c.slug}`, { headers: { 'accept-language': 'en-US,en;q=0.9' } });
  assert.equal(en.body.content.title, 'Ana & Luis');
  assert.equal(en.body.eventType.name, 'Wedding');
  assert.deepEqual(en.body.eventType.hostRoles.map((role) => role.label), ['Bride', 'Groom']);
  const fr = await server.api('GET', `/celebrations/public/${c.slug}`, { headers: { 'accept-language': 'fr-FR' } });
  assert.equal(fr.body.locale, 'es-BO');
  assert.deepEqual(es.body.localTimes.eventDate, { date: '2026-12-19', time: '19:00', timeZone: 'America/La_Paz', utcOffset: '-04:00' });
  assert.equal(JSON.stringify(es.body).includes(host.sub), false, 'no owner id on the public page');
  const sitemap = await server.api('GET', '/celebrations/public?limit=100');
  assert.deepEqual(sitemap.body.items.find((item) => item.slug === c.slug)?.supportedLocales, ['es-BO', 'en-US'], 'listed for the sitemap');
  await server.api('POST', `/celebrations/${c.id}/unpublish`, { token: hostToken, ifMatch: published.body.version });
  await settle();
  assert.equal((await server.api('GET', `/celebrations/public/${c.slug}`)).status, 404);
  assert.equal((await server.api('GET', '/celebrations/public?limit=100')).body.items.some((item) => item.slug === c.slug), false);
});

test('REQ-15-03/04 · the same events applied three times change nothing; drop + replay gives byte-identical rows', async () => {
  const c = await createWedding(server.api, hostToken);
  const p = await server.api('POST', `/celebrations/${c.id}/publish`, { token: hostToken, ifMatch: 1 });
  await server.api('PATCH', `/celebrations/${c.id}`, { token: hostToken, ifMatch: p.body.version, body: { content: { venueName: 'Otro salón' } } });
  await settle();
  const before = JSON.stringify(await server.runtime.publicStore.dump());
  const history = await server.runtime.history.all();
  for (const envelope of [...history, ...history, ...history]) await server.runtime.projector.apply(envelope);
  assert.equal(JSON.stringify(await server.runtime.publicStore.dump()), before);
  const admin = tokenFor(user({ roles: ['ADMIN'] }));
  assert.equal((await server.api('POST', '/celebrations/admin/projections/public/replay', { token: hostToken })).status, 403);
  const replay = await server.api('POST', '/celebrations/admin/projections/public/replay', { token: admin });
  assert.equal(replay.status, 200);
  assert.ok(replay.body.applied > 0);
  assert.equal(JSON.stringify(await server.runtime.publicStore.dump()), before);
  assert.equal((await server.api('GET', `/celebrations/public/${c.slug}`)).body.content.venueName, 'Otro salón');
});

test('REQ-16-05 · template selection only accepts published, compatible templates and never touches content', async () => {
  const wedding = randomUUID();
  const minimal = randomUUID();
  const quince = randomUUID();
  const { app } = server.runtime;
  const { recordTemplateReference } = await import('../dist/index.js');
  await recordTemplateReference(app, { templateId: wedding, tags: ['wedding'], status: 'PUBLISHED' });
  await recordTemplateReference(app, { templateId: minimal, tags: ['wedding', 'minimal'], status: 'PUBLISHED' });
  await recordTemplateReference(app, { templateId: quince, tags: ['quinceanera'], status: 'PUBLISHED' });
  const c = await createWedding(server.api, hostToken);
  const original = JSON.stringify(c.content);
  const incompatible = await server.api('PUT', `/celebrations/${c.id}/template`, { token: hostToken, ifMatch: 1, body: { templateId: quince } });
  assert.equal(incompatible.status, 422);
  assert.equal(incompatible.body.code, 'INCOMPATIBLE_TEMPLATE');
  assert.equal((await server.api('PUT', `/celebrations/${c.id}/template`, { token: hostToken, ifMatch: 1, body: { templateId: randomUUID() } })).body.code, 'UNKNOWN_TEMPLATE');
  const a = await server.api('PUT', `/celebrations/${c.id}/template`, { token: hostToken, ifMatch: 1, body: { templateId: wedding } });
  const b = await server.api('PUT', `/celebrations/${c.id}/template`, { token: hostToken, ifMatch: a.body.version, body: { templateId: minimal } });
  const back = await server.api('PUT', `/celebrations/${c.id}/template`, { token: hostToken, ifMatch: b.body.version, body: { templateId: wedding } });
  assert.equal(back.body.templateId, wedding);
  assert.equal(JSON.stringify(back.body.content), original);
});

test('REQ-11-01/05 · event types are listed from data, translated by Accept-Language with fallback', async () => {
  const es = await server.api('GET', '/celebrations/event-types');
  assert.deepEqual(es.body.items.map((item) => item.code), ['QUINCEANERA', 'WEDDING']);
  assert.equal(es.body.items.find((item) => item.code === 'WEDDING').name, 'Boda');
  const en = await server.api('GET', '/celebrations/event-types/WEDDING', { headers: { 'accept-language': 'en-US' } });
  assert.equal(en.body.name, 'Wedding');
  assert.equal((await server.api('GET', '/celebrations/event-types/WEDDING', { headers: { 'accept-language': 'fr-FR' } })).body.name, 'Boda');
  assert.equal((await server.api('GET', '/celebrations/event-types/NOPE')).status, 404);
});

test('REQ-11-06 · inserting the BAUTIZO seed at runtime lets a host create and publish one, no code touched', async () => {
  const before = await server.api('POST', '/celebrations', { token: hostToken, body: { slug: `bautizo-${randomUUID().slice(0, 6)}`, eventTypeCode: 'BAUTIZO' } });
  assert.equal(before.status, 422);
  await seedEventTypes(server.runtime.app.uow, [await readSeedFile(join(SEEDS_DIR, '003-bautizo.json'))]);
  const created = await server.api('POST', '/celebrations', { token: hostToken, body: { slug: `bautizo-${randomUUID().slice(0, 6)}`, eventTypeCode: 'BAUTIZO', content: { title: 'Bautizo de Mateo', eventDate: '2026-11-08T11:00', venueName: 'Parroquia San Miguel', hosts: { PARENT: 'Lucía' } } } });
  assert.equal(created.status, 201);
  const missing = await server.api('POST', `/celebrations/${created.body.id}/publish`, { token: hostToken, ifMatch: 1 });
  assert.deepEqual(missing.body.missingFields, ['childName']);
  const edited = await server.api('PATCH', `/celebrations/${created.body.id}`, { token: hostToken, ifMatch: 1, body: { content: { childName: 'Mateo' } } });
  const published = await server.api('POST', `/celebrations/${created.body.id}/publish`, { token: hostToken, ifMatch: edited.body.version });
  assert.equal(published.status, 200);
  await settle();
  const page = await server.api('GET', `/celebrations/public/${created.body.slug}`);
  assert.equal(page.body.eventType.name, 'Bautizo');
});

test('F14 · only an ADMIN creates an event type from the API, valid immediately', async () => {
  const definition = { status: 'ACTIVE', defaultLocale: 'es-BO', hostRoles: ['GRADUATE'], enabledSections: ['story', 'schedule'], requiredFieldsForPublish: ['title', 'eventDate'], compatibleTemplateTags: ['graduation'], translations: [{ locale: 'es-BO', name: 'Graduación' }] };
  assert.equal((await server.api('PUT', '/celebrations/admin/event-types/GRADUATION', { token: hostToken, body: definition })).status, 403);
  const admin = tokenFor(user({ roles: ['ADMIN'] }));
  const created = await server.api('PUT', '/celebrations/admin/event-types/GRADUATION', { token: admin, body: definition });
  assert.equal(created.status, 201);
  assert.equal((await server.api('PUT', '/celebrations/admin/event-types/GRADUATION', { token: admin, body: definition })).status, 200);
  assert.equal((await server.api('PUT', '/celebrations/admin/event-types/bad', { token: admin, body: definition })).status, 422);
  assert.ok((await server.api('GET', '/celebrations/admin/event-types', { token: admin })).body.items.some((item) => item.code === 'GRADUATION'));
  assert.equal((await server.api('GET', '/celebrations/admin/event-types', { token: hostToken })).status, 404);
  const c = await server.api('POST', '/celebrations', { token: hostToken, body: { slug: `grad-${randomUUID().slice(0, 6)}`, eventTypeCode: 'GRADUATION', content: { title: 'Grado', eventDate: '2026-12-01T18:00' } } });
  assert.equal((await server.api('POST', `/celebrations/${c.body.id}/publish`, { token: hostToken, ifMatch: 1 })).status, 200);
});

test('collaborators: a CO_HOST manages, a VIEWER reads but gets 403 on writes', async () => {
  const coHost = user();
  const viewer = user();
  const c = await createWedding(server.api, hostToken);
  const added = await server.api('PUT', `/celebrations/${c.id}/collaborators/${coHost.sub}`, { token: hostToken, ifMatch: 1, body: { role: 'CO_HOST' } });
  const both = await server.api('PUT', `/celebrations/${c.id}/collaborators/${viewer.sub}`, { token: hostToken, ifMatch: added.body.version, body: { role: 'VIEWER' } });
  assert.equal((await server.api('PATCH', `/celebrations/${c.id}`, { token: tokenFor(coHost), ifMatch: both.body.version, body: { content: { title: 'Co-host edit' } } })).status, 200);
  const view = await server.api('GET', `/celebrations/${c.id}`, { token: tokenFor(viewer) });
  assert.equal(view.body.access, 'READ');
  assert.equal((await server.api('PATCH', `/celebrations/${c.id}`, { token: tokenFor(viewer), ifMatch: view.body.version, body: { content: { title: 'x' } } })).status, 403);
  const removed = await server.api('DELETE', `/celebrations/${c.id}/collaborators/${viewer.sub}`, { token: hostToken, ifMatch: view.body.version });
  assert.equal(removed.status, 200);
  assert.equal((await server.api('GET', `/celebrations/${c.id}`, { token: tokenFor(viewer) })).status, 404);
});

test('type changes in draft, list paginates, correlation id is echoed', async () => {
  const c = await createWedding(server.api, hostToken);
  const ok = await server.api('PUT', `/celebrations/${c.id}/event-type`, { token: hostToken, ifMatch: 1, body: { eventTypeCode: 'QUINCEANERA' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.eventTypeCode, 'QUINCEANERA');
  assert.deepEqual(ok.body.content.hosts, { BRIDE: 'Ana', GROOM: 'Luis' }, 'changing type never deletes content');
  const titled = await server.api('PATCH', `/celebrations/${c.id}`, { token: hostToken, ifMatch: ok.body.version, body: { content: { title: 'XV' } } });
  assert.equal(titled.status, 200, 'unrelated edits still work after a type change');
  const wrongHosts = await server.api('PATCH', `/celebrations/${c.id}`, { token: hostToken, ifMatch: titled.body.version, body: { content: { hosts: { BRIDE: 'Ana' } } } });
  assert.equal(wrongHosts.body.code, 'UNKNOWN_HOST_ROLE');
  const check = await server.api('GET', `/celebrations/${c.id}/publish-check`, { token: hostToken });
  assert.deepEqual(check.body.missingFields, ['hosts.CELEBRANT']);
  const page = await server.api('GET', '/celebrations?limit=1&offset=0', { token: hostToken });
  assert.equal(page.body.items.length, 1);
  const response = await server.api('GET', '/celebrations/health', { headers: { 'x-correlation-id': '0b6f8c1e-2a1d-4c5e-9f00-1234567890ab' } });
  assert.equal(response.headers.get('x-correlation-id'), '0b6f8c1e-2a1d-4c5e-9f00-1234567890ab');
  assert.match((await server.api('GET', '/celebrations/health', { headers: { 'x-correlation-id': 'not-uuid' } })).headers.get('x-correlation-id'), /^[0-9a-f-]{36}$/);
  assert.equal(ALL_SEEDS.length >= 6, true);
});
