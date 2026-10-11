import assert from 'node:assert/strict';
import test from 'node:test';
import { Money, createCatalogedGift, createExternalGift, InMemoryGiftItemRepository, GiftListService, DomainError, orderGiftItems } from '../dist/index.js';

const catalog = (id = 'gift') => createCatalogedGift({ id, listId: 'list', title: 'Mixer', price: Money.of(12000, 'BOB'), catalog: { productListingId: 'product', providerVerified: true } });
test('uses minor-unit money and enforces one list per celebration', () => {
  assert.throws(() => Money.of(1.2, 'BOB'), DomainError); const service = new GiftListService(new InMemoryGiftItemRepository()); service.createList('l', 'c'); assert.throws(() => service.createList('l2', 'c'), /one gift list/);
});
test('external gifts are validated, restricted, and sorted after cataloged', () => {
  assert.throws(() => createExternalGift({ id: 'e', listId: 'l', title: 'Bad', price: Money.of(1, 'USD'), external: { url: 'nope' } }, 'AUTO_ACCEPT'), DomainError);
  const external = createExternalGift({ id: 'e', listId: 'l', title: 'Ext', price: Money.of(1, 'USD'), external: { url: 'https://example.com/x' } }, 'RESTRICTED');
  assert.equal(external.status, 'PROPOSED'); assert.deepEqual(orderGiftItems([external, catalog()]).map(x => x.id), ['gift', 'e']);
});
test('restricted reservations, host review, release, and safe setting default', () => {
  const repo = new InMemoryGiftItemRepository(), service = new GiftListService(repo); service.add(catalog());
  const reservation = service.requestReservation('r', 'gift', 'guest', 'c'); assert.equal(reservation.status, 'PENDING_REVIEW'); assert.throws(() => service.resolveReservation('r', 'other', 'host', true), /Only the host/);
  service.resolveReservation('r', 'host', 'host', false); assert.equal(repo.get('gift').status, 'AVAILABLE');
  service.applySettings('ev1', 'c', 'AUTO_ACCEPT'); service.applySettings('ev1', 'c', 'RESTRICTED'); const second = service.requestReservation('r2', 'gift', 'guest2', 'c'); assert.equal(second.status, 'COMMITTED');
});
test('twenty competing reservations have exactly one winner using compare-and-set', async () => {
  const repo = new InMemoryGiftItemRepository(), service = new GiftListService(repo); service.add(catalog()); service.applySettings('auto', 'c', 'AUTO_ACCEPT');
  const attempts = await Promise.all(Array.from({ length: 20 }, (_, i) => Promise.resolve().then(() => { try { service.requestReservation(`r${i}`, 'gift', `g${i}`, 'c'); return 201; } catch (e) { return e.status; } })));
  assert.equal(attempts.filter(x => x === 201).length, 1); assert.equal(attempts.filter(x => x === 409).length, 19);
});
