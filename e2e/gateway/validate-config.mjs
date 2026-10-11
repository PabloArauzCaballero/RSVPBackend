import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const kong = await readFile(new URL('../../infra/kong/kong.yml', import.meta.url), 'utf8');

test('declares a route for each of the seven backend services', () => {
  for (const service of ['identity-service', 'celebration-site-service', 'template-media-service', 'guest-rsvp-service', 'notification-service', 'gift-list-service', 'provider-catalog-service']) {
    assert.match(kong, new RegExp(`name: ${service}`));
  }
});

test('marks public routes and rate-limits public RSVP and redirect traffic', () => {
  for (const route of ['identity', 'public-rsvp', 'partner-redirect']) {
    const routeIndex = kong.indexOf(`name: ${route}`);
    assert.notEqual(routeIndex, -1);
    assert.match(kong.slice(routeIndex, routeIndex + 300), /rsvp-public/);
  }
  assert.match(kong, /name: rate-limiting/);
  assert.match(kong, /header_name: X-Correlation-Id/);
  assert.match(kong, /name: request-size-limiting/);
});
