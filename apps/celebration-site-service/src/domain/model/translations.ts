import { InvariantError } from '../errors.js';

export const DEFAULT_LOCALE = 'es-BO';

/** Per-locale overrides of the celebration content: `{ 'en-US': { title: 'Ana & Luis' } }`. */
export type TranslationMap = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

// BCP-47 language with optional region. Matches "es-BO"; rejects "es_bo".
// https://regex101.com/?flavor=javascript&regex=%5E%5Ba-z%5D%7B2%2C3%7D(%3F%3A-%5BA-Z%5D%7B2%7D)%3F%24&flags=gm&testString=es-BO%0Aes_bo
const LOCALE_TAG = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;

// One Accept-Language entry. Matches "en-US;q=0.8" → ("en-US", "0.8"); rejects ";q=1".
// https://regex101.com/?flavor=javascript&regex=%5E%5Cs*(%5BA-Za-z%5D%7B1%2C8%7D(%3F%3A-%5BA-Za-z0-9%5D%7B1%2C8%7D)*%7C%5C*)%5Cs*(%3F%3A%3B%5Cs*q%5Cs*%3D%5Cs*(%5B0-9.%5D%2B))%3F%5Cs*%24&flags=gm&testString=en-US%3Bq%3D0.8%0A%3Bq%3D1
const ACCEPT_ENTRY = /^\s*([A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*|\*)\s*(?:;\s*q\s*=\s*([0-9.]+))?\s*$/;

const WILDCARD = '*';
const LANGUAGE_SEPARATOR = '-';

export function assertLocale(tag: string): string {
  if (!LOCALE_TAG.test(tag)) throw new InvariantError('INVALID_LOCALE', `"${tag}" is not a locale like es-BO`, { field: 'locale' });
  return tag;
}

interface WeightedTag { readonly tag: string; readonly q: number; readonly order: number }

/** Parses an Accept-Language header into tags by descending preference; malformed entries are ignored. */
export function parseAcceptLanguage(header: string | undefined): string[] {
  if (!header) return [];
  return header.split(',')
    .map((entry, order): WeightedTag | undefined => {
      const match = ACCEPT_ENTRY.exec(entry);
      if (!match) return undefined;
      const q = match[2] === undefined ? 1 : Number(match[2]);
      return Number.isFinite(q) && q > 0 ? { tag: match[1]!, q, order } : undefined;
    })
    .filter((entry): entry is WeightedTag => entry !== undefined)
    .sort((a, b) => b.q - a.q || a.order - b.order)
    .map((entry) => entry.tag);
}

const language = (tag: string): string => tag.split(LANGUAGE_SEPARATOR)[0]!.toLowerCase();

/**
 * Picks the best supported locale: exact tag, then same language ("es" or "es-AR"
 * selects "es-BO"), then the fallback. Unsupported requests never fail.
 */
export function resolveLocale(requested: string | undefined, supported: readonly string[], fallback: string): string {
  const preferences = parseAcceptLanguage(requested);
  const exact = preferences
    .map((tag) => supported.find((candidate) => candidate.toLowerCase() === tag.toLowerCase()))
    .find((candidate) => candidate !== undefined);
  if (exact) return exact;
  const byLanguage = preferences
    .filter((tag) => tag !== WILDCARD)
    .map((tag) => supported.find((candidate) => language(candidate) === language(tag)))
    .find((candidate) => candidate !== undefined);
  return byLanguage ?? fallback;
}

/** Content as seen in `locale`: the default-locale content overlaid with that locale's overrides. */
export function localisedContent(content: Readonly<Record<string, unknown>>, translations: TranslationMap, locale: string): Record<string, unknown> {
  return { ...content, ...(translations[locale] ?? {}) };
}
