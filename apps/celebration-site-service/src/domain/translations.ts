export type TranslationMap = Record<string, Record<string, string>>;
export function resolveLocale(requested: string | undefined, supported: string[], defaultLocale: string): string { const candidate = requested?.split(',')[0]?.trim(); return candidate && supported.includes(candidate) ? candidate : defaultLocale; }
export function translated(map: TranslationMap, locale: string, defaultLocale: string): Record<string, string> { return map[locale] ?? map[defaultLocale] ?? {}; }
