import assert from 'node:assert/strict';
import test from 'node:test';
import { ProviderCatalogService, DomainError, publishListing, boliviaGeo, categories, categoryTranslations, computeListingScore, isBot, isDuplicate, monthCalendar } from '../dist/index.js';

const provider = { id:'p', ownerId:'owner', status:'DRAFT', plan:'PREMIUM', currency:'BOB', timeZone:'America/La_Paz' };
const fulfillment = { responsible:'PROVIDER', coverageZones:['Cochabamba'], leadTimeDays:3, conditions:{es:'Según disponibilidad'}, disclaimer:'La plataforma no presta ni transporta el servicio.' };
const listing = (overrides={}) => ({ id:'l',providerId:'p',type:'SERVICE',category:'CATERING',titles:{'es-BO':'Comida'},descriptions:{'es-BO':'Comida'},destinations:{OFFICIAL_SITE:'https://partner.example/book'},geo:boliviaGeo[1],fulfillment,published:false,...overrides });
function verifiedService() { const service=new ProviderCatalogService(); service.register(provider); service.transitionProvider('p','PENDING_VERIFICATION',{id:'owner',admin:false}); service.transitionProvider('p','VERIFIED',{id:'admin',admin:true}); service.addListing(publishListing(listing())); return service; }

test('only verified providers are publicly searchable, and listings require destinations and fulfillment', () => {
  const service=new ProviderCatalogService(); service.register(provider); service.addListing({...listing(),published:true}); assert.equal(service.publicSearch().length,0);
  assert.throws(()=>publishListing(listing({destinations:{}})),e=>e instanceof DomainError&&e.status===422); assert.throws(()=>publishListing(listing({fulfillment:undefined})),e=>e instanceof DomainError&&e.code==='FULFILLMENT_REQUIRED');
  service.transitionProvider('p','PENDING_VERIFICATION',{id:'owner',admin:false}); service.transitionProvider('p','VERIFIED',{id:'admin',admin:true}); assert.equal(service.publicSearch().length,1);
});
test('Bolivia seed, category translations and proximity order are deterministic', () => {
  assert.equal(boliviaGeo.length,9); assert.equal(categories.length,11); assert.equal(categoryTranslations.PHOTOGRAPHY['en-US'],'Photography');
  const service=verifiedService(); service.addListing(publishListing(listing({id:'near',geo:boliviaGeo[0]}))); assert.deepEqual(service.publicSearch(boliviaGeo[0]).map(x=>x.id),['near','l']);
});
test('redirect persists a lead before a permanent-safe 302 with UTM/correlation fields', () => {
  const service=verifiedService(); const one=service.redirect({id:'lead1',listingId:'l',destination:'OFFICIAL_SITE',sessionId:'s',correlationId:'corr',userAgent:'Mozilla',context:{surface:'PUBLIC'}});
  assert.equal(one.status,302, '301 is forbidden because browsers cache it and bypass lead counting'); assert.match(one.location,/utm_source=rsvp/); assert.match(one.location,/correlationId=corr/); assert.equal(service.leads.length,1);
  const dup=service.redirect({id:'lead2',listingId:'l',destination:'OFFICIAL_SITE',sessionId:'s',correlationId:'corr2',userAgent:'Mozilla',context:{},now:new Date(one.lead.occurredAt.getTime()+1)}); assert.equal(dup.lead.invalidReason,'dup');
  const bot=service.redirect({id:'lead3',listingId:'l',destination:'OFFICIAL_SITE',sessionId:'b',correlationId:'c',userAgent:'Googlebot',context:{}}); assert.equal(bot.lead.invalidReason,'bot'); assert.equal(isBot('Googlebot'),true); assert.equal(isDuplicate(dup.lead,[one.lead],30),true);
});
test('ranking caps penalize but do not hide, and bookings enforce capacity/ownership/expiration', () => {
  assert.ok(computeListingScore({verified:true,plan:'PREMIUM',location:'CITY',capReached:true}) < computeListingScore({verified:true,plan:'PREMIUM',location:'CITY',capReached:false}));
  const service=verifiedService(), availability={providerId:'p',timeZone:'America/La_Paz',capacityPerDay:1,rules:[{weekdays:[1,2,3,4,5,6,0],start:'08:00',end:'20:00'}],blackouts:[]};
  service.requestBooking({id:'b1',providerId:'p',date:'2026-10-12',requesterId:'u',status:'REQUESTED',expiresAt:new Date('2026-10-13')},availability);
  assert.throws(()=>service.requestBooking({id:'b2',providerId:'p',date:'2026-10-12',requesterId:'u2',status:'REQUESTED',expiresAt:new Date()},availability),e=>e.status===409);
  assert.throws(()=>service.resolveBooking('b1','intruder',true),e=>e.status===403); service.expireBookings(new Date('2026-10-14')); assert.equal(service.bookings[0].status,'EXPIRED'); assert.equal(monthCalendar(availability,2026,10,{})[11].available,true);
});
test('quote creates an event and metric replay is deterministic', () => {
  const service=verifiedService(); service.requestQuote({id:'q',providerId:'p',listingIds:['l'],eventDate:'2027-01-02',guestCount:20,contact:{name:'A',email:'a@example.test'}}); assert.equal(service.events.at(-1).name,'QuoteRequested.v1');
  service.redirect({id:'lead',listingId:'l',destination:'OFFICIAL_SITE',sessionId:'s',correlationId:'c',context:{}}); const before=JSON.stringify([...service.metrics]); const replay=JSON.stringify([...service.replayMetrics()]); assert.equal(replay,before);
});
test('lead configuration, caps and availability updates remain provider-owned', () => {
  const service=verifiedService(); service.configureLead('p','owner',{enabledDestinations:['OFFICIAL_SITE'],utmSource:'rsvp',utmMedium:'partner',dedupeMinutes:30,monthlyCap:1,billingModel:'CPC'});
  service.setAvailability({providerId:'p',timeZone:'America/La_Paz',capacityPerDay:2,rules:[{weekdays:[1],start:'08:00',end:'20:00'}],blackouts:[]},'owner');
  service.redirect({id:'capped',listingId:'l',destination:'OFFICIAL_SITE',sessionId:'other',correlationId:'cap',context:{}});
  assert.equal(service.events.some(x=>x.name==='ProviderLeadCapReached.v1'),true); assert.equal(service.events.some(x=>x.name==='ProviderAvailabilityUpdated.v1'),true);
  assert.throws(()=>service.configureLead('p','other',{enabledDestinations:['OFFICIAL_SITE'],utmSource:'x',utmMedium:'x',dedupeMinutes:1,monthlyCap:0,billingModel:'CPC'}),e=>e.status===403);
});
