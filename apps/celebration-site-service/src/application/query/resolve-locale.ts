import { resolveLocale } from '../../domain/model/translations.js';

/**
 * Locale of a response (REQ-14-01/02): Kong forwards `Accept-Language` untouched;
 * the best supported match wins, and an unsupported request (fr-FR) gets the
 * celebration's default locale instead of an error.
 */
export function resolveRequestLocale(acceptLanguage: string | undefined, supportedLocales: readonly string[], defaultLocale: string): string {
  return resolveLocale(acceptLanguage, supportedLocales, defaultLocale);
}
