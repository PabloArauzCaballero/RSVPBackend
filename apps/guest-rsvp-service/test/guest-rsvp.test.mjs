import assert from 'node:assert/strict';
import test from 'node:test';
import { AccessToken, CompanionMode, DomainError, Guest, GuestGroup, GuestProjection, GuestRsvpService, GuestTokenGuard, Rsvp, RsvpStatus, confirmUnregistered, hashToken, importGuestsCsv, redact, requestErasure, resolveCompanions } from '../src/index.mjs';

test('lanes 17: guest invariants, groups, locale fallback and partial CSV import', () => {
  assert.throws(() => new Guest({ celebrationId: 'c', name: 'Ana', email: 'wrong', allowedCompanions: 0 }), (e) => e.code === 'ValidationFailed');
  const ana = new Guest({ celebrationId: 'c', name: 'Ana', email: 'ANA@example.com', allowedCompanions: 2 });
  const group = new GuestGroup({ celebrationId: 'c', name: 'Familia' }); group.add(ana);
  assert.equal(ana.resolvedLocale('es-BO'), 'es-BO'); assert.equal(group.memberIds.has(ana.id), true);
  const stored = []; const result = importGuestsCsv('name,email,locale,allowedCompanions\nAna,ana@example.com,,1\nBad,nope,en-US,0\nBob,bob@example.com,en-US,-1\nCara,cara@example.com,en-US,0', { celebrationId: 'c', defaultLocale: 'es-BO', register: (g) => stored.push(g) });
  assert.equal(result.imported.length, 2); assert.deepEqual(result.errors.map((e) => e.line), [3, 4]); assert.equal(stored[0].locale, 'es-BO');
});

test('lane 18: 256-bit opaque tokens are hashed, revocable, non-enumerable and redacted', () => {
  const issued = AccessToken.issue({ guestId: 'g1', celebrationId: 'c1' }); const other = AccessToken.issue({ guestId: 'g2', celebrationId: 'c2' });
  assert.equal(issued.raw.length >= 43, true); assert.notEqual(issued.raw, other.raw); assert.equal(issued.hash, hashToken(issued.raw)); assert.notEqual(issued.hash, issued.raw);
  const store = new Map([[issued.hash, issued], [other.hash, other]]); const guard = new GuestTokenGuard(store);
  assert.equal(guard.authenticate(issued.raw, 'c1'), 'g1'); assert.throws(() => guard.authenticate('not-a-token', 'c1'), (e) => e.code === 'Unauthorized'); assert.throws(() => guard.authenticate(other.raw, 'c1'), (e) => e.code === 'NotFound');
  issued.revoke(); assert.throws(() => guard.authenticate(issued.raw, 'c1'), (e) => e.code === 'Unauthorized'); assert.equal(redact(`token=${other.raw}`).includes(other.raw), false);
});

test('lane 19: RSVP transitions use a fixed instant deadline and write the correct event', () => {
  const deadline = new Date('2026-10-11T04:00:00.000Z'); const rsvp = new Rsvp({ guestId: 'g' });
  assert.equal(rsvp.respond(RsvpStatus.CONFIRMED, { now: new Date('2026-10-11T03:59:00Z'), deadline, dietaryNotes: 'vegan', message: 'hola' }), 'RsvpConfirmed.v1');
  assert.equal(rsvp.respond(RsvpStatus.DECLINED, { now: new Date('2026-10-11T03:59:59Z'), deadline }), 'RsvpChanged.v1');
  assert.throws(() => rsvp.respond(RsvpStatus.CONFIRMED, { now: new Date('2026-10-11T04:01:00Z'), deadline }), (e) => e.code === 'RsvpWindowClosed');
  const service = new GuestRsvpService(); const guest = service.register({ celebrationId: 'c', name: 'Ana', email: 'ana@example.com', allowedCompanions: 0 }); service.respond({ guestId: guest.id, celebrationId: 'c', status: RsvpStatus.CONFIRMED, deadline, now: new Date('2026-10-11T03:00:00Z') }); assert.equal(service.outbox[0].eventName, 'RsvpConfirmed.v1');
});

test('lane 20: companion and unregistered modes are evaluated at command time with safe default', () => {
  const cases = [
    [CompanionMode.AUTO_ACCEPT, 3, 1, 3, undefined], [CompanionMode.RESTRICTED, 3, 1, 1, 'PENDING_REVIEW'],
    [CompanionMode.AUTO_ACCEPT, 1, 1, 1, undefined], [CompanionMode.RESTRICTED, 1, 1, 1, undefined]
  ];
  for (const [mode, requested, allowed, approved, pending] of cases) { const value = resolveCompanions({ mode, requested, allowed }); assert.equal(value.approved, approved); assert.equal(value.request?.status, pending); }
  assert.throws(() => confirmUnregistered({ createGuest: () => 'guest' }), (e) => e.code === 'Forbidden'); assert.equal(confirmUnregistered({ mode: CompanionMode.AUTO_ACCEPT, createGuest: () => 'guest' }), 'guest');
});

test('lane 21: event projections are idempotent and replay deterministically', () => {
  const events = [{ id: '1', type: 'RsvpConfirmed.v1', guestId: 'g1', celebrationId: 'c', name: 'Ana', status: 'CONFIRMED', approvedCompanions: 2 }, { id: '2', type: 'RsvpDeclined.v1', guestId: 'g2', celebrationId: 'c', name: 'Bob', status: 'DECLINED', approvedCompanions: 0 }];
  const projection = new GuestProjection(); events.forEach((event) => projection.consume(event)); events.forEach((event) => projection.consume(event)); const before = projection.summary('c'); assert.deepEqual({ confirmed: before.confirmed, declined: before.declined, pending: before.pending, companions: before.companions }, { confirmed: 1, declined: 1, pending: 0, companions: 2 }); assert.equal(projection.list('c', { status: 'CONFIRMED', search: 'an' }).total, 1); projection.replay(events); const after = projection.summary('c'); assert.equal(after.companions, 2);
});

test('lane 22: erasure is irreversible, emits event and preserves RSVP aggregates', () => {
  const guest = new Guest({ celebrationId: 'c', name: 'Ana Private', email: 'private@example.com', allowedCompanions: 1 }); const rsvp = new Rsvp({ guestId: guest.id, status: RsvpStatus.CONFIRMED, dietaryNotes: 'private', message: 'private' }); const emitted = [];
  requestErasure({ guest, rsvp, emit: (event) => emitted.push(event), now: new Date('2026-10-11') }); assert.equal(guest.name, 'Deleted guest'); assert.equal(guest.email.includes('private'), false); assert.equal(rsvp.status, RsvpStatus.CONFIRMED); assert.equal(rsvp.message, undefined); assert.equal(emitted[0].type, 'GuestErasureRequested.v1');
});
