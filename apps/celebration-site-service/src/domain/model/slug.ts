import { InvariantError } from '../errors.js';

const MIN_SLUG_LENGTH = 3;
const MAX_SLUG_LENGTH = 80;

// Lowercase words joined by single hyphens. Matches "ana-y-luis-2026"; rejects "Ana--Luis".
// https://regex101.com/?flavor=javascript&regex=%5E%5Ba-z0-9%5D%2B(%3F%3A-%5Ba-z0-9%5D%2B)*%24&flags=gm&testString=ana-y-luis-2026%0AAna--Luis
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Paths of the public site that a celebration slug must never shadow. */
const RESERVED: ReadonlySet<string> = new Set(['admin', 'api', 'panel', 'proveedores', 'catalogo', 'public', 'health', 'ready', 'login', 'rsvp', 'event-types']);

export function assertSlug(value: string): string {
  const lengthOk = typeof value === 'string' && value.length >= MIN_SLUG_LENGTH && value.length <= MAX_SLUG_LENGTH;
  if (!lengthOk || !SLUG_PATTERN.test(value)) {
    throw new InvariantError('INVALID_SLUG', `Slug must be ${MIN_SLUG_LENGTH}-${MAX_SLUG_LENGTH} lowercase letters, digits or single hyphens`, { field: 'slug' });
  }
  if (RESERVED.has(value)) throw new InvariantError('RESERVED_SLUG', `Slug "${value}" is reserved`, { field: 'slug' });
  return value;
}
