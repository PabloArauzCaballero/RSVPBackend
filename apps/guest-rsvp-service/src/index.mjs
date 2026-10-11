import { createHash, randomBytes, randomUUID } from 'node:crypto';

export class DomainError extends Error {
  constructor(code, message, details = undefined) { super(message); this.code = code; this.details = details; }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const requireText = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) throw new DomainError('ValidationFailed', `${field} is required`, { field });
  return value.trim();
};
export const sanitizeText = (value) => typeof value === 'string' ? value.trim() : '';

/** Framework-free aggregate used by lanes 17, 20 and 22. */
export class Guest {
  constructor({ id = randomUUID(), celebrationId, email, name, locale, allowedCompanions, groupId = undefined, consentGivenAt = new Date(), erasedAt = undefined }) {
    this.id = id; this.celebrationId = requireText(celebrationId, 'celebrationId');
    if (!emailPattern.test(email ?? '')) throw new DomainError('ValidationFailed', 'email must be valid', { field: 'email' });
    this.email = email.toLowerCase(); this.name = requireText(name, 'name');
    if (!Number.isInteger(allowedCompanions) || allowedCompanions < 0) throw new DomainError('ValidationFailed', 'allowedCompanions must be a non-negative integer', { field: 'allowedCompanions' });
    this.locale = locale || undefined; this.allowedCompanions = allowedCompanions; this.groupId = groupId; this.consentGivenAt = consentGivenAt; this.erasedAt = erasedAt;
  }
  resolvedLocale(defaultLocale) { return this.locale || defaultLocale; }
  anonymize(at = new Date()) { this.email = `erased-${this.id}@invalid.local`; this.name = 'Deleted guest'; this.locale = undefined; this.erasedAt = at; }
}

export class GuestGroup {
  constructor({ id = randomUUID(), celebrationId, name, memberIds = [] }) { this.id = id; this.celebrationId = requireText(celebrationId, 'celebrationId'); this.name = requireText(name, 'name'); this.memberIds = new Set(memberIds); }
  add(guest) { if (guest.celebrationId !== this.celebrationId) throw new DomainError('CrossTenant', 'Guest belongs to another celebration'); guest.groupId = this.id; this.memberIds.add(guest.id); }
}

/** Partial-by-design importer: valid records persist, invalid lines are returned to correct the CSV. */
export function importGuestsCsv(csv, { celebrationId, defaultAllowedCompanions = 0, defaultLocale, register }) {
  const lines = String(csv ?? '').replace(/^\uFEFF/u, '').split(/\r?\n/u).filter((line) => line.trim());
  if (lines.length < 2) return { imported: [], errors: [{ line: 1, reason: 'CSV must include header and at least one row' }] };
  const headers = lines[0].split(',').map((value) => value.trim().toLowerCase());
  const fields = ['name', 'email', 'locale', 'allowedcompanions'];
  if (fields.some((field) => !headers.includes(field))) return { imported: [], errors: [{ line: 1, reason: 'Header must include name,email,locale,allowedCompanions' }] };
  const imported = []; const errors = [];
  for (let index = 1; index < lines.length; index += 1) {
    const values = lines[index].split(',').map((value) => value.trim()); const row = Object.fromEntries(headers.map((field, i) => [field, values[i] ?? '']));
    try {
      const allowed = row.allowedcompanions === '' ? defaultAllowedCompanions : Number(row.allowedcompanions);
      const guest = new Guest({ celebrationId, name: row.name, email: row.email, locale: row.locale || defaultLocale, allowedCompanions: allowed });
      register(guest); imported.push(guest);
    } catch (error) { errors.push({ line: index + 1, reason: error.message, field: error.details?.field }); }
  }
  return { imported, errors };
}

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
export class AccessToken {
  constructor({ guestId, celebrationId, raw = randomBytes(32).toString('base64url'), hash = undefined, revokedAt = undefined }) { this.guestId = guestId; this.celebrationId = celebrationId; this.raw = raw; this.hash = hash ?? hashToken(raw); this.revokedAt = revokedAt; }
  revoke(at = new Date()) { this.revokedAt = at; }
  static issue(input) { return new AccessToken(input); }
}
export class GuestTokenGuard {
  constructor(tokens) { this.tokens = tokens; }
  authenticate(rawToken, celebrationId) {
    const token = this.tokens.get(hashToken(rawToken));
    if (!token || token.revokedAt) throw new DomainError('Unauthorized', 'Invalid guest token');
    if (token.celebrationId !== celebrationId) throw new DomainError('NotFound', 'Celebration not found');
    return token.guestId;
  }
}
export const redact = (value) => String(value).replace(/[A-Za-z0-9_-]{32,}/gu, '[REDACTED]');

export const RsvpStatus = Object.freeze({ PENDING: 'PENDING', CONFIRMED: 'CONFIRMED', DECLINED: 'DECLINED' });
export class Rsvp {
  constructor({ guestId, status = RsvpStatus.PENDING, dietaryNotes = undefined, message = undefined, requestedCompanions = 0, approvedCompanions = 0 }) { this.guestId = guestId; this.status = status; this.dietaryNotes = dietaryNotes; this.message = message; this.requestedCompanions = requestedCompanions; this.approvedCompanions = approvedCompanions; }
  respond(status, { now, deadline, dietaryNotes, message, requestedCompanions = this.requestedCompanions }) {
    if (now.getTime() > deadline.getTime()) throw new DomainError('RsvpWindowClosed', `RSVP window closed at ${deadline.toISOString()}`);
    if (![RsvpStatus.CONFIRMED, RsvpStatus.DECLINED].includes(status)) throw new DomainError('ValidationFailed', 'Invalid RSVP status');
    const previous = this.status; this.status = status; this.dietaryNotes = dietaryNotes; this.message = message; this.requestedCompanions = requestedCompanions;
    return previous === RsvpStatus.PENDING ? (status === RsvpStatus.CONFIRMED ? 'RsvpConfirmed.v1' : 'RsvpDeclined.v1') : 'RsvpChanged.v1';
  }
}
export const CompanionMode = Object.freeze({ AUTO_ACCEPT: 'AUTO_ACCEPT', RESTRICTED: 'RESTRICTED' });
export function resolveCompanions({ requested, allowed, mode = CompanionMode.RESTRICTED }) {
  if (!Number.isInteger(requested) || requested < 0) throw new DomainError('ValidationFailed', 'requestedCompanions must be non-negative');
  if (requested <= allowed || mode === CompanionMode.AUTO_ACCEPT) return { approved: requested, request: undefined };
  return { approved: allowed, request: { status: 'PENDING_REVIEW', requested: requested - allowed } };
}
export function confirmUnregistered({ mode = CompanionMode.RESTRICTED, createGuest }) { if (mode !== CompanionMode.AUTO_ACCEPT) throw new DomainError('Forbidden', 'Unregistered RSVP is restricted'); return createGuest(); }

export class GuestProjection {
  constructor() { this.events = new Set(); this.rows = new Map(); }
  consume(event) {
    if (this.events.has(event.id)) return false; this.events.add(event.id);
    const row = this.rows.get(event.guestId) ?? { celebrationId: event.celebrationId, guestId: event.guestId, status: RsvpStatus.PENDING, approvedCompanions: 0, name: event.name ?? 'Guest', groupId: event.groupId };
    if (event.type.startsWith('Rsvp')) { row.status = event.status; row.approvedCompanions = event.approvedCompanions ?? 0; }
    if (event.type === 'GuestErased.v1') row.name = 'Deleted guest'; this.rows.set(event.guestId, row); return true;
  }
  summary(celebrationId) { const rows = [...this.rows.values()].filter((row) => row.celebrationId === celebrationId); return { confirmed: rows.filter((r) => r.status === RsvpStatus.CONFIRMED).length, declined: rows.filter((r) => r.status === RsvpStatus.DECLINED).length, pending: rows.filter((r) => r.status === RsvpStatus.PENDING).length, companions: rows.reduce((n, r) => n + r.approvedCompanions, 0), updatedAt: new Date() }; }
  list(celebrationId, { status, groupId, search = '', page = 1, pageSize = 50 } = {}) { const term = search.toLowerCase(); const filtered = [...this.rows.values()].filter((r) => r.celebrationId === celebrationId && (!status || r.status === status) && (!groupId || r.groupId === groupId) && (!term || r.name.toLowerCase().includes(term))); return { total: filtered.length, items: filtered.slice((page - 1) * pageSize, page * pageSize) }; }
  replay(events) { this.events.clear(); this.rows.clear(); events.forEach((event) => this.consume(event)); }
}

export function requestErasure({ guest, rsvp, emit, now = new Date() }) { guest.anonymize(now); rsvp.dietaryNotes = undefined; rsvp.message = undefined; emit({ type: 'GuestErasureRequested.v1', guestId: guest.id, celebrationId: guest.celebrationId, occurredAt: now.toISOString() }); return guest; }

/** Explicit in-memory composition root used for deterministic tests and local work. */
export class GuestRsvpService {
  constructor() { this.guests = new Map(); this.tokens = new Map(); this.rsvps = new Map(); this.outbox = []; }
  register(input) { const guest = new Guest(input); this.guests.set(guest.id, guest); return guest; }
  issueToken(guestId) { const guest = this.guests.get(guestId); if (!guest) throw new DomainError('NotFound', 'Guest not found'); for (const token of this.tokens.values()) if (token.guestId === guestId) token.revoke(); const token = AccessToken.issue({ guestId, celebrationId: guest.celebrationId }); this.tokens.set(token.hash, token); return token; }
  respond({ guestId, celebrationId, status, deadline, now = new Date(), ...data }) { const guest = this.guests.get(guestId); if (!guest || guest.celebrationId !== celebrationId) throw new DomainError('NotFound', 'Guest not found'); const rsvp = this.rsvps.get(guestId) ?? new Rsvp({ guestId }); if (this.rsvps.has(guestId) && rsvp.status === RsvpStatus.PENDING) {} const eventName = rsvp.respond(status, { deadline, now, ...data }); this.rsvps.set(guestId, rsvp); this.outbox.push({ id: randomUUID(), eventName, guestId, celebrationId, payload: { status: rsvp.status, approvedCompanions: rsvp.approvedCompanions } }); return rsvp; }
}
