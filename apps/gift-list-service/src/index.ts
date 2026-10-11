/** Framework-free gift-list domain (lanes 25-28). HTTP/Nest adapters may map DomainError to RFC 9457 responses. */
export class DomainError extends Error { constructor(readonly code: string, message: string, readonly status: number) { super(message); } }
export const conflict = (code: string, message: string) => new DomainError(code, message, 409);
export const invalid = (code: string, message: string) => new DomainError(code, message, 422);
export const forbidden = (code: string, message: string) => new DomainError(code, message, 403);

export class Money {
  private constructor(readonly minor: number, readonly currency: string) {}
  static of(minor: number, currency: string): Money {
    if (!Number.isSafeInteger(minor) || minor < 0) throw invalid('INVALID_MONEY', 'Money uses a non-negative integer amount in minor units.');
    if (!/^[A-Z]{3}$/.test(currency)) throw invalid('INVALID_CURRENCY', 'Currency must be an ISO-4217 uppercase code.');
    return new Money(minor, currency);
  }
}

export type GiftSource = 'CATALOGED' | 'EXTERNAL';
export type GiftItemStatus = 'AVAILABLE' | 'PROPOSED' | 'PENDING_REVIEW' | 'COMMITTED' | 'REJECTED';
export type ReservationMode = 'AUTO_ACCEPT' | 'RESTRICTED';
export type ExternalGiftMode = 'AUTO_ACCEPT' | 'RESTRICTED';
export type ReservationStatus = 'PENDING_REVIEW' | 'COMMITTED' | 'REJECTED';

export interface CatalogReference { productListingId: string; providerVerified: boolean; }
export interface ExternalReference { url: string; }
export interface GiftItem {
  id: string; listId: string; title: string; price: Money; source: GiftSource; status: GiftItemStatus;
  version: number; catalog?: CatalogReference; external?: ExternalReference;
}
export interface GiftList { id: string; celebrationId: string; itemIds: string[]; }
export interface GiftReservation { id: string; itemId: string; guestId: string; status: ReservationStatus; }
export interface DomainEvent { name: string; aggregateId: string; payload: Record<string, unknown>; }

const allowed: Record<GiftItemStatus, readonly GiftItemStatus[]> = {
  AVAILABLE: ['PENDING_REVIEW', 'COMMITTED', 'PROPOSED'], PROPOSED: ['AVAILABLE', 'REJECTED'],
  PENDING_REVIEW: ['COMMITTED', 'REJECTED'], COMMITTED: [], REJECTED: ['AVAILABLE']
};
export function transitionItem(item: GiftItem, next: GiftItemStatus): GiftItem {
  if (!allowed[item.status].includes(next)) throw conflict('INVALID_GIFT_TRANSITION', `Cannot transition gift from ${item.status} to ${next}.`);
  return { ...item, status: next, version: item.version + 1 };
}
export function effectiveReservationMode(mode: ReservationMode | undefined): ReservationMode { return mode ?? 'RESTRICTED'; }

export function createCatalogedGift(input: Omit<GiftItem, 'source' | 'status' | 'version' | 'catalog' | 'external'> & { catalog: CatalogReference }): GiftItem {
  if (!input.catalog.providerVerified) throw invalid('CATALOG_PRODUCT_UNAVAILABLE', 'A cataloged gift must reference a verified partner product.');
  return { ...input, source: 'CATALOGED', status: 'AVAILABLE', version: 0, catalog: input.catalog };
}
export function createExternalGift(input: Omit<GiftItem, 'source' | 'status' | 'version' | 'catalog' | 'external'> & { external: ExternalReference }, mode: ExternalGiftMode): GiftItem {
  try { const url = new URL(input.external.url); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); } catch { throw invalid('INVALID_EXTERNAL_URL', 'External gifts require a valid http(s) URL.'); }
  return { ...input, source: 'EXTERNAL', status: mode === 'RESTRICTED' ? 'PROPOSED' : 'AVAILABLE', version: 0, external: input.external };
}
export function orderGiftItems(items: readonly GiftItem[]): GiftItem[] { return [...items].sort((a, b) => Number(a.source === 'EXTERNAL') - Number(b.source === 'EXTERNAL')); }

export interface GiftItemRepository {
  get(id: string): GiftItem | undefined;
  save(item: GiftItem): void;
  compareAndSet(id: string, expectedVersion: number, next: GiftItem): boolean;
}
/** In-memory adapter mirrors UPDATE ... WHERE id = ? AND version = ?; production adapter must use the same predicate. */
export class InMemoryGiftItemRepository implements GiftItemRepository {
  private readonly items = new Map<string, GiftItem>();
  get(id: string): GiftItem | undefined { const item = this.items.get(id); return item && { ...item }; }
  save(item: GiftItem): void { this.items.set(item.id, { ...item }); }
  compareAndSet(id: string, expectedVersion: number, next: GiftItem): boolean {
    const current = this.items.get(id); if (!current || current.version !== expectedVersion) return false; this.items.set(id, { ...next }); return true;
  }
}
export class GiftListService {
  private readonly listsByCelebration = new Map<string, GiftList>();
  readonly reservations = new Map<string, GiftReservation>();
  readonly events: DomainEvent[] = [];
  private settings = new Map<string, ReservationMode>();
  constructor(private readonly items: GiftItemRepository) {}
  createList(id: string, celebrationId: string): GiftList {
    if (this.listsByCelebration.has(celebrationId)) throw conflict('GIFT_LIST_EXISTS', 'A celebration can only have one gift list.');
    const list = { id, celebrationId, itemIds: [] }; this.listsByCelebration.set(celebrationId, list); this.emit('GiftListCreated.v1', id, { celebrationId }); return list;
  }
  add(item: GiftItem): void { this.items.save(item); this.emit(item.source === 'EXTERNAL' && item.status === 'PROPOSED' ? 'ExternalGiftProposed.v1' : 'GiftItemAdded.v1', item.id, { listId: item.listId }); }
  applySettings(eventId: string, celebrationId: string, mode: ReservationMode): void { if (this.seenSettings.has(eventId)) return; this.seenSettings.add(eventId); this.settings.set(celebrationId, mode); }
  private readonly seenSettings = new Set<string>();
  requestReservation(id: string, itemId: string, guestId: string, celebrationId: string): GiftReservation {
    const item = this.items.get(itemId); if (!item || item.status !== 'AVAILABLE') throw conflict('GIFT_NOT_AVAILABLE', 'This gift is no longer available; please choose another one.');
    const mode = effectiveReservationMode(this.settings.get(celebrationId));
    const target: GiftItemStatus = mode === 'AUTO_ACCEPT' ? 'COMMITTED' : 'PENDING_REVIEW';
    const next = transitionItem(item, target);
    if (!this.items.compareAndSet(item.id, item.version, next)) throw conflict('GIFT_NOT_AVAILABLE', 'This gift was just reserved by someone else; please choose another one.');
    const reservation: GiftReservation = { id, itemId, guestId, status: target === 'COMMITTED' ? 'COMMITTED' : 'PENDING_REVIEW' }; this.reservations.set(id, reservation);
    this.emit(target === 'COMMITTED' ? 'GiftReservationAutoCommitted.v1' : 'GiftReservationRequested.v1', id, { itemId, guestId }); return reservation;
  }
  resolveReservation(reservationId: string, actorId: string, hostId: string, approve: boolean): GiftReservation {
    if (actorId !== hostId) throw forbidden('HOST_REQUIRED', 'Only the host can resolve a pending gift reservation.');
    const reservation = this.reservations.get(reservationId); if (!reservation || reservation.status !== 'PENDING_REVIEW') throw conflict('RESERVATION_NOT_PENDING', 'Reservation is not pending review.');
    const item = this.items.get(reservation.itemId); if (!item) throw conflict('GIFT_NOT_FOUND', 'Gift no longer exists.');
    const next = transitionItem(item, approve ? 'COMMITTED' : 'REJECTED');
    if (!this.items.compareAndSet(item.id, item.version, next)) throw conflict('GIFT_NOT_AVAILABLE', 'Gift changed while resolving reservation.');
    reservation.status = approve ? 'COMMITTED' : 'REJECTED'; this.emit(approve ? 'GiftReservationConfirmed.v1' : 'GiftReservationRejected.v1', reservationId, { itemId: item.id });
    if (!approve) { const released = transitionItem(next, 'AVAILABLE'); this.items.compareAndSet(released.id, next.version, released); this.emit('GiftItemReleased.v1', item.id, { reservationId }); }
    return { ...reservation };
  }
  private emit(name: string, aggregateId: string, payload: Record<string, unknown>): void { this.events.push({ name, aggregateId, payload }); }
}
