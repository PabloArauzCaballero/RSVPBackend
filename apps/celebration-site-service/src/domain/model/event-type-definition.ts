import { InvariantError } from '../errors.js';
import { assertLocale, resolveLocale } from './translations.js';

/**
 * An event type is data (lane 11). Weddings, quinceañeras or baptisms differ only
 * in the rows that describe them: host roles, sections, publish requirements and
 * compatible templates. Nothing in the code branches on a type code.
 */

export const EventTypeStatus = { Active: 'ACTIVE', Retired: 'RETIRED' } as const;
export type EventTypeStatus = (typeof EventTypeStatus)[keyof typeof EventTypeStatus];

/** Sections the theme engine knows how to render; a type enables a subset in its own order. */
export const KNOWN_SECTIONS = ['story', 'schedule', 'venues', 'gallery', 'dressCode', 'faq', 'recommendations', 'gifts', 'rsvp'] as const;
export type SectionId = (typeof KNOWN_SECTIONS)[number];

export interface EventTypeTranslation {
  readonly locale: string;
  readonly name: string;
  readonly description?: string;
  /** Label of each host role in this locale, e.g. `{ BRIDE: 'Novia' }`. */
  readonly hostRoleLabels?: Readonly<Record<string, string>>;
}

export interface EventTypeDefinition {
  readonly code: string;
  readonly status: EventTypeStatus;
  readonly defaultLocale: string;
  readonly hostRoles: readonly string[];
  readonly enabledSections: readonly SectionId[];
  /** Dot paths into the celebration content, e.g. `title`, `eventDate`, `hosts.BRIDE`. */
  readonly requiredFieldsForPublish: readonly string[];
  readonly compatibleTemplateTags: readonly string[];
  readonly translations: readonly EventTypeTranslation[];
}

export interface TranslatedEventType {
  readonly code: string;
  readonly locale: string;
  readonly name: string;
  readonly description: string | null;
  readonly hostRoles: readonly { readonly role: string; readonly label: string }[];
  readonly enabledSections: readonly SectionId[];
  readonly requiredFieldsForPublish: readonly string[];
  readonly compatibleTemplateTags: readonly string[];
}

// Upper snake case code. Matches "GRADUATION"; rejects "graduation".
// https://regex101.com/?flavor=javascript&regex=%5E%5BA-Z%5D%5BA-Z0-9_%5D%7B1%2C39%7D%24&flags=gm&testString=GRADUATION%0Agraduation
const TYPE_CODE = /^[A-Z][A-Z0-9_]{1,39}$/;

// Upper snake case role. Matches "BRIDE"; rejects "bride".
// https://regex101.com/?flavor=javascript&regex=%5E%5BA-Z%5D%5BA-Z0-9_%5D%7B0%2C39%7D%24&flags=gm&testString=BRIDE%0Abride
const ROLE_CODE = /^[A-Z][A-Z0-9_]{0,39}$/;

// Dot path into content. Matches "hosts.BRIDE"; rejects "Hosts..x".
// https://regex101.com/?flavor=javascript&regex=%5E%5Ba-z%5D%5Ba-zA-Z0-9%5D*(%3F%3A%5C.%5BA-Za-z0-9_%5D%2B)*%24&flags=gm&testString=hosts.BRIDE%0AHosts..x
const FIELD_PATH = /^[a-z][a-zA-Z0-9]*(?:\.[A-Za-z0-9_]+)*$/;

// Template tag in kebab case. Matches "wedding-classic"; rejects "Wedding".
// https://regex101.com/?flavor=javascript&regex=%5E%5Ba-z%5D%5Ba-z0-9-%5D%7B0%2C39%7D%24&flags=gm&testString=wedding-classic%0AWedding
const TEMPLATE_TAG = /^[a-z][a-z0-9-]{0,39}$/;

const invalid = (message: string, field: string): InvariantError => new InvariantError('INVALID_EVENT_TYPE', message, { field });
const isSection = (value: string): value is SectionId => (KNOWN_SECTIONS as readonly string[]).includes(value);
const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;
const statuses: readonly string[] = Object.values(EventTypeStatus);

/** Validates a definition supplied as data (seed file, admin editor) and returns it frozen. */
export function defineEventType(input: EventTypeDefinition): EventTypeDefinition {
  if (!TYPE_CODE.test(input.code)) throw invalid('Event type code must be UPPER_SNAKE_CASE', 'code');
  if (!statuses.includes(input.status)) throw invalid(`Status must be one of ${statuses.join(', ')}`, 'status');
  assertLocale(input.defaultLocale);
  if (!input.hostRoles.length || !unique(input.hostRoles) || !input.hostRoles.every((role) => ROLE_CODE.test(role))) throw invalid('hostRoles must be unique UPPER_SNAKE_CASE roles', 'hostRoles');
  if (!input.enabledSections.length || !unique(input.enabledSections) || !input.enabledSections.every(isSection)) throw invalid(`enabledSections must be unique values of ${KNOWN_SECTIONS.join(', ')}`, 'enabledSections');
  if (!unique(input.requiredFieldsForPublish) || !input.requiredFieldsForPublish.every((path) => FIELD_PATH.test(path))) throw invalid('requiredFieldsForPublish must be unique dot paths', 'requiredFieldsForPublish');
  if (!input.compatibleTemplateTags.length || !unique(input.compatibleTemplateTags) || !input.compatibleTemplateTags.every((tag) => TEMPLATE_TAG.test(tag))) throw invalid('compatibleTemplateTags must be unique kebab-case tags', 'compatibleTemplateTags');
  input.translations.forEach((translation) => assertLocale(translation.locale));
  if (!unique(input.translations.map((translation) => translation.locale))) throw invalid('One translation per locale', 'translations');
  if (!input.translations.some((translation) => translation.locale === input.defaultLocale)) throw invalid('A translation in defaultLocale is required', 'translations');
  if (input.translations.some((translation) => !translation.name.trim())) throw invalid('Every translation needs a name', 'translations');
  return Object.freeze({
    ...input,
    hostRoles: Object.freeze([...input.hostRoles]),
    enabledSections: Object.freeze([...input.enabledSections]),
    requiredFieldsForPublish: Object.freeze([...input.requiredFieldsForPublish]),
    compatibleTemplateTags: Object.freeze([...input.compatibleTemplateTags]),
    translations: Object.freeze(input.translations.map((translation) => Object.freeze({ ...translation })))
  });
}

export function supportedLocalesOf(type: EventTypeDefinition): string[] {
  return type.translations.map((translation) => translation.locale);
}

/** The type in the requested locale, falling back to the type's default locale. */
export function translateEventType(type: EventTypeDefinition, requestedLocale: string | undefined): TranslatedEventType {
  const locale = resolveLocale(requestedLocale, supportedLocalesOf(type), type.defaultLocale);
  const translation = type.translations.find((item) => item.locale === locale) ?? type.translations.find((item) => item.locale === type.defaultLocale);
  const fallbackLabels = type.translations.find((item) => item.locale === type.defaultLocale)?.hostRoleLabels ?? {};
  return {
    code: type.code,
    locale,
    name: translation?.name ?? type.code,
    description: translation?.description ?? null,
    hostRoles: type.hostRoles.map((role) => ({ role, label: translation?.hostRoleLabels?.[role] ?? fallbackLabels[role] ?? role })),
    enabledSections: type.enabledSections,
    requiredFieldsForPublish: type.requiredFieldsForPublish,
    compatibleTemplateTags: type.compatibleTemplateTags
  };
}

/** True when a template carrying `templateTags` may be offered for this type. */
export function acceptsTemplate(type: EventTypeDefinition, templateTags: readonly string[]): boolean {
  return templateTags.some((tag) => type.compatibleTemplateTags.includes(tag));
}
