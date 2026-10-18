import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Celebration, ConflictError, InvariantError, PublishRequirementsError, Money, roundHalfEven, defineEventType,
  translateEventType, acceptsTemplate, resolveLocale, parseAcceptLanguage, localisedContent, localToUtc, toLocal,
  normaliseTemporal, localTimesOf, assertTimeZone, applySettingsPatch, defaultSettings, rsvpWindowClosed,
  accessLevel, missingFieldsForPublish, assertSlug, CelebrationEventType
} from '../dist/index.js';
import { ALL_SEEDS } from './support.mjs';

const now = '2026-10-17T12:00:00.000Z';
const later = '2026-10-17T13:00:00.000Z';
const type = (code) => ALL_SEEDS.find((item) => item.code === code);
const WEDDING = type('WEDDING');
const QUINCE = type('QUINCEANERA');
const BAUTIZO = type('BAUTIZO');
const owner = '22222222-2222-4222-8222-222222222222';
const base = { id: '11111111-1111-4111-8111-111111111111', slug: 'ana-y-luis', ownerId: owner };
const fullWedding = { title: 'Ana y Luis', eventDate: '2026-12-19T19:00', venueName: 'Salón', hosts: { BRIDE: 'Ana', GROOM: 'Luis' } };

test('REQ-10-03 · DRAFT, PUBLISHED and ARCHIVED with explicit transitions; forbidden ones are 409', () => {
  const c = Celebration.create({ ...base, content: fullWedding }, WEDDING, now);
  assert.equal(c.status, 'DRAFT');
  c.publish(WEDDING, now);
  assert.equal(c.status, 'PUBLISHED');
  assert.throws(() => c.publish(WEDDING, now), (e) => e instanceof ConflictError && e.status === 409 && e.code === 'INVALID_TRANSITION');
  c.unpublish('typo in date', later);
  assert.equal(c.status, 'DRAFT');
  c.archive(later);
  assert.equal(c.status, 'ARCHIVED');
  assert.throws(() => c.publish(WEDDING, later), (e) => e.status === 409);
  assert.throws(() => c.unpublish(null, later), (e) => e.status === 409);
  assert.throws(() => c.archive(later), (e) => e.status === 409);
  assert.throws(() => c.edit({ content: { title: 'x' } }, WEDDING, later), (e) => e.code === 'CELEBRATION_ARCHIVED');
});

test('REQ-10-02 · slug is validated and immutable once published, even after unpublishing', () => {
  assert.throws(() => assertSlug('Ana--Luis'), InvariantError);
  assert.throws(() => assertSlug('admin'), (e) => e.code === 'RESERVED_SLUG');
  const c = Celebration.create({ ...base, content: fullWedding }, WEDDING, now);
  c.edit({ slug: 'ana-luis-2026' }, WEDDING, now);
  assert.equal(c.state.slug, 'ana-luis-2026');
  c.publish(WEDDING, now);
  assert.throws(() => c.edit({ slug: 'otro' }, WEDDING, now), (e) => e.status === 409 && e.code === 'SLUG_IMMUTABLE');
  c.unpublish(null, now);
  assert.throws(() => c.edit({ slug: 'otro' }, WEDDING, now), (e) => e.code === 'SLUG_IMMUTABLE');
});

test('REQ-10-04 · version increments once per command and stale versions are rejected', () => {
  const c = Celebration.create({ ...base }, WEDDING, now);
  assert.equal(c.version, 1);
  c.edit({ content: { title: 'A' } }, WEDDING, now);
  assert.equal(c.version, 2);
  assert.throws(() => c.assertVersion(1), (e) => e.code === 'VERSION_CONFLICT' && e.status === 409);
  c.edit({ content: { title: 'A' } }, WEDDING, now);
  assert.equal(c.version, 2, 'a no-op edit does not bump the version');
});

test('REQ-12-06 · a new celebration is RESTRICTED in all four modes', () => {
  const c = Celebration.create(base, WEDDING, now);
  const s = c.state.settings;
  assert.deepEqual([s.giftReservationMode, s.unregisteredRsvpMode, s.extraCompanionMode, s.externalGiftMode], ['RESTRICTED', 'RESTRICTED', 'RESTRICTED', 'RESTRICTED']);
  assert.equal(s.partnerPriorityEnabled, false);
  assert.equal(s.rsvpDeadline, null);
});

test('REQ-12-01/03/04 · settings change is versioned and carries effectiveFrom; nothing changes when values match', () => {
  const initial = defaultSettings(now);
  const unchanged = applySettingsPatch(initial, { giftReservationMode: 'RESTRICTED' }, later);
  assert.deepEqual(unchanged.changedFields, []);
  assert.equal(unchanged.settings, initial);
  const { settings, changedFields } = applySettingsPatch(initial, { giftReservationMode: 'AUTO_ACCEPT', rsvpDeadline: '2026-12-01T23:59:00-04:00', partnerPriorityEnabled: true }, later);
  assert.deepEqual(changedFields, ['giftReservationMode', 'rsvpDeadline', 'partnerPriorityEnabled']);
  assert.equal(settings.settingsVersion, 2);
  assert.equal(settings.effectiveFrom, later);
  assert.equal(settings.rsvpDeadline, '2026-12-02T03:59:00.000Z');
  assert.throws(() => applySettingsPatch(initial, { externalGiftMode: 'YES' }, later), (e) => e.code === 'INVALID_APPROVAL_MODE');
  assert.throws(() => applySettingsPatch(initial, { rsvpDeadline: 'tomorrow' }, later), (e) => e.code === 'INVALID_RSVP_DEADLINE');
  assert.throws(() => applySettingsPatch(initial, { rsvpDeadline: '2026-12-10T23:59' }, later), (e) => e.code === 'INVALID_RSVP_DEADLINE', 'a wall clock needs the celebration zone');
  assert.equal(applySettingsPatch(initial, { rsvpDeadline: '2026-12-10T23:59' }, later, 'America/La_Paz').settings.rsvpDeadline, '2026-12-11T03:59:00.000Z', 'wall clock read in La Paz');
  assert.equal(rsvpWindowClosed(settings, '2026-12-02T04:00:00Z'), true);
  assert.equal(rsvpWindowClosed(settings, '2026-12-02T03:00:00Z'), false);
});

test('REQ-12-02 · settings event payload is flat and complete for Guest/RSVP and Gift List', () => {
  const c = Celebration.create(base, WEDDING, now);
  c.pullEvents();
  assert.equal(c.changeSettings({ extraCompanionMode: 'AUTO_ACCEPT' }, later), true);
  const [event] = c.pullEvents();
  assert.equal(event.type, CelebrationEventType.SettingsUpdated);
  for (const key of ['celebrationId', 'giftReservationMode', 'unregisteredRsvpMode', 'extraCompanionMode', 'externalGiftMode', 'rsvpDeadline', 'partnerPriorityEnabled', 'settingsVersion', 'effectiveFrom', 'timeZone', 'defaultLocale', 'changedFields', 'aggregateVersion']) {
    assert.ok(Object.hasOwn(event.payload, key), `payload has ${key}`);
  }
  assert.equal(c.changeSettings({ extraCompanionMode: 'AUTO_ACCEPT' }, later), false);
  assert.deepEqual(c.pullEvents(), []);
});

test('REQ-11-02/03/04 · roles, publish requirements and templates come from the type rows', () => {
  assert.deepEqual(WEDDING.hostRoles, ['BRIDE', 'GROOM']);
  assert.deepEqual(QUINCE.hostRoles, ['CELEBRANT']);
  assert.notDeepEqual(WEDDING.requiredFieldsForPublish, QUINCE.requiredFieldsForPublish);
  assert.equal(acceptsTemplate(WEDDING, ['wedding']), true);
  assert.equal(acceptsTemplate(QUINCE, ['wedding']), false);
  assert.throws(() => Celebration.create({ ...base, content: { hosts: { BRIDE: 'Ana' } } }, QUINCE, now), (e) => e.code === 'UNKNOWN_HOST_ROLE');
});

test('REQ-11-05 · type translations per locale with fallback to the type default', () => {
  assert.equal(translateEventType(WEDDING, 'en-US').name, 'Wedding');
  assert.equal(translateEventType(WEDDING, 'es-BO').name, 'Boda');
  const fallback = translateEventType(WEDDING, 'fr-FR');
  assert.equal(fallback.locale, 'es-BO');
  assert.equal(fallback.name, 'Boda');
  assert.deepEqual(translateEventType(WEDDING, 'en-US').hostRoles, [{ role: 'BRIDE', label: 'Bride' }, { role: 'GROOM', label: 'Groom' }]);
});

test('event type definitions are validated as data', () => {
  const valid = { code: 'GRADUATION', status: 'ACTIVE', defaultLocale: 'es-BO', hostRoles: ['GRADUATE'], enabledSections: ['story'], requiredFieldsForPublish: ['title'], compatibleTemplateTags: ['graduation'], translations: [{ locale: 'es-BO', name: 'Graduación' }] };
  assert.equal(defineEventType(valid).code, 'GRADUATION');
  assert.throws(() => defineEventType({ ...valid, code: 'graduation' }), (e) => e.details.field === 'code');
  assert.throws(() => defineEventType({ ...valid, enabledSections: ['unknown'] }), (e) => e.details.field === 'enabledSections');
  assert.throws(() => defineEventType({ ...valid, translations: [{ locale: 'en-US', name: 'Graduation' }] }), (e) => e.details.field === 'translations');
  assert.throws(() => defineEventType({ ...valid, requiredFieldsForPublish: ['Bad..path'] }), (e) => e.details.field === 'requiredFieldsForPublish');
  assert.throws(() => defineEventType({ ...valid, hostRoles: [] }), (e) => e.details.field === 'hostRoles');
  assert.throws(() => defineEventType({ ...valid, status: 'MAYBE' }), (e) => e.details.field === 'status');
});

test('REQ-13-01/02 · publish needs every field of its own type; the error lists exactly what is missing', () => {
  const wedding = Celebration.create({ ...base, content: { title: 'Ana y Luis', hosts: { BRIDE: 'Ana' } } }, WEDDING, now);
  assert.throws(() => wedding.publish(WEDDING, now), (e) => e instanceof PublishRequirementsError && e.status === 422 && JSON.stringify(e.missingFields) === JSON.stringify(['eventDate', 'venueName', 'hosts.GROOM']));
  const quince = Celebration.create({ ...base, id: '33333333-3333-4333-8333-333333333333', slug: 'xv-maria', content: { title: 'XV', eventDate: '2027-01-10T20:00', venueName: 'Club' } }, QUINCE, now);
  assert.deepEqual(quince.publishReadiness(QUINCE), ['hosts.CELEBRANT']);
  assert.deepEqual(missingFieldsForPublish({ title: '  ', eventDate: [], venueName: {} }, { requiredFieldsForPublish: ['title', 'eventDate', 'venueName'] }), ['title', 'eventDate', 'venueName']);
});

test('REQ-11-06 · a type known only as data (BAUTIZO) is created and published without any code for it', () => {
  const c = Celebration.create({ ...base, slug: 'bautizo-mateo', content: { title: 'Bautizo de Mateo', eventDate: '2026-11-08T11:00', venueName: 'Parroquia', childName: 'Mateo', hosts: { PARENT: 'Lucía' } } }, BAUTIZO, now);
  c.publish(BAUTIZO, now);
  assert.equal(c.status, 'PUBLISHED');
});

test('REQ-16-05 (domain side) · switching template and back leaves content byte-identical', () => {
  const c = Celebration.create({ ...base, content: fullWedding, translations: {} }, WEDDING, now);
  const before = JSON.stringify({ content: c.state.content, translations: c.state.translations });
  c.selectTemplate('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ['wedding'], WEDDING, now);
  c.selectTemplate('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', ['wedding', 'minimal'], WEDDING, now);
  c.selectTemplate('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ['wedding'], WEDDING, now);
  assert.equal(JSON.stringify({ content: c.state.content, translations: c.state.translations }), before);
  assert.throws(() => c.selectTemplate('cccccccc-cccc-4ccc-8ccc-cccccccccccc', ['quinceanera'], WEDDING, now), (e) => e.code === 'INCOMPATIBLE_TEMPLATE');
});

test('changing the event type keeps content and is only allowed in DRAFT', () => {
  const c = Celebration.create({ ...base, content: { title: 'X', notes: 'keep me' } }, WEDDING, now);
  c.assignType(QUINCE, now);
  assert.equal(c.state.eventTypeCode, 'QUINCEANERA');
  assert.equal(c.state.content.notes, 'keep me');
  const p = Celebration.create({ ...base, content: fullWedding }, WEDDING, now);
  p.publish(WEDDING, now);
  assert.throws(() => p.assignType(QUINCE, now), (e) => e.status === 409);
});

test('REQ-10-05 · access: owner, co-host, org planner manage; viewer and org member read; strangers see nothing', () => {
  const facts = { ownerId: owner, organizationId: 'org-1', collaborators: [{ userId: 'co', role: 'CO_HOST' }, { userId: 'viewer', role: 'VIEWER' }] };
  const actor = (userId, roles = [], organizationIds = []) => ({ userId, roles, organizationIds });
  assert.equal(accessLevel(facts, actor(owner)), 'MANAGE');
  assert.equal(accessLevel(facts, actor('co')), 'MANAGE');
  assert.equal(accessLevel(facts, actor('viewer')), 'READ');
  assert.equal(accessLevel(facts, actor('planner', ['PLANNER'], ['org-1'])), 'MANAGE');
  assert.equal(accessLevel(facts, actor('assistant', [], ['org-1'])), 'READ');
  assert.equal(accessLevel(facts, actor('planner-elsewhere', ['PLANNER'], ['org-2'])), 'NONE');
  assert.equal(accessLevel(facts, actor('admin', ['ADMIN'])), 'MANAGE');
  assert.equal(accessLevel(facts, actor('stranger')), 'NONE');
});

test('REQ-14-05/06 · Money is integer minor units with ISO-4217; BOB by default, any supported currency', () => {
  const price = Money.parse('150.50');
  assert.equal(price.minorUnits, 15050);
  assert.equal(price.currency, 'BOB');
  assert.equal(price.add(Money.of(50)).toDecimalString(), '151.00');
  assert.equal(Money.parse('99.99', 'USD').currency, 'USD');
  assert.equal(Money.parse('1500', 'CLP').minorUnits, 1500);
  assert.throws(() => Money.of(1.5), (e) => e.code === 'INVALID_MONEY');
  assert.throws(() => Money.parse('1.234', 'BOB'), (e) => e.code === 'INVALID_MONEY');
  assert.throws(() => Money.of(1, 'XYZ'), (e) => e.code === 'UNSUPPORTED_CURRENCY');
  assert.throws(() => Money.of(1, 'BOB').add(Money.of(1, 'USD')), (e) => e.code === 'CURRENCY_MISMATCH');
  assert.equal(Money.of(-5, 'KWD').toDecimalString(), '-0.005');
  assert.deepEqual(JSON.parse(JSON.stringify(price)), { amountMinor: 15050, currency: 'BOB' });
});

test('REQ-14-05 · rounding is half-even with integers, and allocation never loses a cent', () => {
  assert.equal(roundHalfEven(25n, 10n), 2n);
  assert.equal(roundHalfEven(35n, 10n), 4n);
  assert.equal(roundHalfEven(-25n, 10n), -2n);
  assert.equal(roundHalfEven(26n, 10n), 3n);
  assert.equal(Money.of(1001).percentage(1250).minorUnits, 125, '12.5% of 10.01 = 1.25125 → 1.25');
  assert.equal(Money.of(1020).percentage(1250).minorUnits, 128, '12.5% of 10.20 = 1.275 → 1.28 (half-even)');
  const parts = Money.of(10000).allocate([1, 1, 1]);
  assert.deepEqual(parts.map((part) => part.minorUnits), [3334, 3333, 3333]);
  assert.equal(parts.reduce((sum, part) => sum + part.minorUnits, 0), 10000);
  // A hundred prices added stay exact, which floats would not.
  const total = Array.from({ length: 100 }, () => Money.parse('0.10')).reduce((sum, item) => sum.add(item));
  assert.equal(total.toDecimalString(), '10.00');
  assert.match(Money.parse('1234.5').format('es-BO'), /1\.234,50/);
  assert.match(Money.parse('1234.5', 'USD').format('en-US'), /\$1,234\.50/);
});

test('REQ-14-01/02 · Accept-Language resolution with q-values, language match and fallback', () => {
  assert.deepEqual(parseAcceptLanguage('fr-FR, en-US;q=0.8, es;q=0.9'), ['fr-FR', 'es', 'en-US']);
  assert.equal(resolveLocale('fr-FR', ['es-BO', 'en-US'], 'es-BO'), 'es-BO');
  assert.equal(resolveLocale('en-US,es;q=0.5', ['es-BO', 'en-US'], 'es-BO'), 'en-US');
  assert.equal(resolveLocale('es-AR', ['es-BO', 'en-US'], 'en-US'), 'es-BO');
  assert.equal(resolveLocale('en', ['es-BO', 'en-US'], 'es-BO'), 'en-US');
  assert.equal(resolveLocale(undefined, ['es-BO'], 'es-BO'), 'es-BO');
  assert.equal(resolveLocale('*;q=1, garbage;;;', ['es-BO'], 'es-BO'), 'es-BO');
  assert.deepEqual(localisedContent({ title: 'Boda', venueName: 'Salón' }, { 'en-US': { title: 'Wedding' } }, 'en-US'), { title: 'Wedding', venueName: 'Salón' });
});

test('REQ-14-04 · La Paz event at 23:30 is stored in UTC and rendered in La Paz, crossing midnight', () => {
  const utc = localToUtc('2026-12-19T23:30', 'America/La_Paz');
  assert.equal(utc, '2026-12-20T03:30:00.000Z');
  assert.deepEqual(toLocal(utc, 'America/La_Paz'), { date: '2026-12-19', time: '23:30', timeZone: 'America/La_Paz', utcOffset: '-04:00' });
  // The same instant, if someone wrongly rendered it in Madrid, would be next morning:
  assert.deepEqual(toLocal(utc, 'Europe/Madrid'), { date: '2026-12-20', time: '04:30', timeZone: 'Europe/Madrid', utcOffset: '+01:00' });
});

test('REQ-14-04 · Madrid DST: spring gap moves forward, autumn overlap takes the first occurrence', () => {
  // 2026-03-29 02:00 → 03:00 in Madrid: 02:30 does not exist.
  const gap = localToUtc('2026-03-29T02:30', 'Europe/Madrid');
  assert.equal(gap, '2026-03-29T01:30:00.000Z');
  assert.equal(toLocal(gap, 'Europe/Madrid').time, '03:30');
  // 2026-10-25 03:00 → 02:00: 02:30 happens twice; the first is still CEST (+02:00).
  const overlap = localToUtc('2026-10-25T02:30', 'Europe/Madrid');
  assert.equal(overlap, '2026-10-25T00:30:00.000Z');
  assert.equal(toLocal(overlap, 'Europe/Madrid').utcOffset, '+02:00');
  // Saturday night before the change and Sunday evening after it.
  assert.equal(localToUtc('2026-10-24T23:30', 'Europe/Madrid'), '2026-10-24T21:30:00.000Z');
  assert.equal(localToUtc('2026-10-25T20:00', 'Europe/Madrid'), '2026-10-25T19:00:00.000Z');
  assert.equal(toLocal('2026-03-28T23:30:00Z', 'Europe/Madrid').date, '2026-03-29');
});

test('temporal normalisation and local times walk the whole content', () => {
  assert.equal(normaliseTemporal('2026-12-19T19:00:00-04:00', 'Europe/Madrid'), '2026-12-19T23:00:00.000Z');
  assert.throws(() => normaliseTemporal('19/12/2026', 'America/La_Paz'), (e) => e.code === 'INVALID_LOCAL_DATE_TIME');
  assert.throws(() => normaliseTemporal('2026-02-30T10:00', 'America/La_Paz'), (e) => e.code === 'INVALID_LOCAL_DATE_TIME');
  assert.throws(() => assertTimeZone('Mars/Olympus'), (e) => e.code === 'INVALID_TIME_ZONE');
  assert.throws(() => assertTimeZone('EST'), (e) => e.code === 'INVALID_TIME_ZONE');
  const c = Celebration.create({ ...base, timeZone: 'America/La_Paz', content: { eventDate: '2026-12-19T19:00', schedule: [{ title: 'Ceremonia', startsAt: '2026-12-19T19:00' }, { title: 'Fiesta', startsAt: '2026-12-19T23:30' }] } }, WEDDING, now);
  assert.equal(c.state.content.schedule[1].startsAt, '2026-12-20T03:30:00.000Z');
  const local = localTimesOf(c.state.content, 'America/La_Paz');
  assert.equal(local['schedule.1.startsAt'].time, '23:30');
  assert.equal(local['schedule.1.startsAt'].date, '2026-12-19');
  assert.equal(local.eventDate.time, '19:00');
});

test('locales and translations are validated against the celebration', () => {
  assert.throws(() => Celebration.create({ ...base, defaultLocale: 'es-BO', supportedLocales: ['en-US'] }, WEDDING, now), (e) => e.code === 'INVALID_LOCALES');
  assert.throws(() => Celebration.create({ ...base, translations: { 'en-US': { title: 'x' } } }, WEDDING, now), (e) => e.code === 'UNSUPPORTED_LOCALE');
  assert.throws(() => Celebration.create({ ...base, supportedLocales: ['es-BO', 'en-US'], translations: { 'en-US': { eventDate: 'x' } } }, WEDDING, now), (e) => e.code === 'INVALID_TRANSLATION');
  const c = Celebration.create({ ...base, supportedLocales: ['es-BO', 'en-US'], translations: { 'en-US': { title: 'Wedding' } } }, WEDDING, now);
  c.edit({ translations: { 'en-US': null } }, WEDDING, now);
  assert.deepEqual(c.state.translations, {});
  c.edit({ content: { title: 'T', venueName: 'V' } }, WEDDING, now);
  c.edit({ content: { venueName: null } }, WEDDING, now);
  assert.deepEqual(c.state.content, { title: 'T' });
  c.edit({ defaultLocale: 'en-US' }, WEDDING, now);
  assert.deepEqual(c.state.supportedLocales, ['es-BO', 'en-US']);
  assert.throws(() => c.edit({ currency: 'XXX' }, WEDDING, now), (e) => e.code === 'UNSUPPORTED_CURRENCY');
  assert.throws(() => Celebration.create({ ...base, content: { blob: 'x'.repeat(300_000) } }, WEDDING, now), (e) => e.code === 'CONTENT_TOO_LARGE');
});

test('collaborators are managed on the aggregate', () => {
  const c = Celebration.create(base, WEDDING, now);
  c.setCollaborator('co', 'CO_HOST', now);
  c.setCollaborator('co', 'VIEWER', now);
  assert.deepEqual(c.state.collaborators, [{ userId: 'co', role: 'VIEWER' }]);
  c.setCollaborator('co', null, now);
  assert.deepEqual(c.state.collaborators, []);
  assert.throws(() => c.setCollaborator(owner, 'CO_HOST', now), (e) => e.code === 'OWNER_IS_NOT_COLLABORATOR');
});

test('a retired type cannot be used for new celebrations', () => {
  const retired = defineEventType({ ...WEDDING, status: 'RETIRED' });
  assert.throws(() => Celebration.create(base, retired, now), (e) => e.code === 'EVENT_TYPE_RETIRED');
});
