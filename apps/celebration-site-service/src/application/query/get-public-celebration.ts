import { NotFoundError } from '../../domain/errors.js';
import type { EventTypeSnapshot } from '../../domain/event/celebration-events.js';
import type { SectionId } from '../../domain/model/event-type-definition.js';
import { localisedContent, type TranslationMap } from '../../domain/model/translations.js';
import { localTimesOf, type LocalDateTime } from '../../domain/model/zoned-time.js';
import type { PublicCelebrationStore } from '../ports.js';
import { resolveRequestLocale } from './resolve-locale.js';

/** Shape stored in `read_public_celebration.document`, written only by the projector. */
export interface PublicCelebrationDocument {
  readonly celebrationId: string;
  readonly slug: string;
  readonly eventType: EventTypeSnapshot;
  readonly defaultLocale: string;
  readonly supportedLocales: readonly string[];
  readonly timeZone: string;
  readonly currency: string;
  readonly templateId: string | null;
  readonly content: Readonly<Record<string, unknown>>;
  readonly translations: TranslationMap;
  readonly rsvpDeadline: string | null;
  readonly publishedAt: string | null;
}

export interface PublicCelebrationView {
  readonly celebrationId: string;
  readonly slug: string;
  readonly locale: string;
  readonly availableLocales: readonly string[];
  readonly eventType: { readonly code: string; readonly name: string; readonly hostRoles: readonly { readonly role: string; readonly label: string }[] };
  readonly enabledSections: readonly SectionId[];
  readonly timeZone: string;
  readonly currency: string;
  readonly templateId: string | null;
  readonly content: Readonly<Record<string, unknown>>;
  readonly localTimes: Readonly<Record<string, LocalDateTime>>;
  readonly rsvpDeadline: string | null;
  readonly publishedAt: string | null;
  readonly version: number;
}

function translateType(type: EventTypeSnapshot, locale: string): PublicCelebrationView['eventType'] {
  const translation = type.translations.find((item) => item.locale === locale) ?? type.translations.find((item) => item.locale === type.defaultLocale);
  return {
    code: type.code,
    name: translation?.name ?? type.code,
    hostRoles: type.hostRoles.map((role) => ({ role, label: translation?.hostRoleLabels?.[role] ?? role }))
  };
}

/**
 * Lane 15: one read of the projection resolves the whole page, in any locale,
 * without touching the write model. Not published → 404 that reveals nothing.
 */
export async function getPublicCelebration(store: PublicCelebrationStore, slug: string, acceptLanguage: string | undefined): Promise<PublicCelebrationView> {
  const row = await store.getBySlug(slug);
  if (!row) throw new NotFoundError();
  // The projector is the only writer of `document` and always writes this shape.
  const document = row.document as unknown as PublicCelebrationDocument;
  const locale = resolveRequestLocale(acceptLanguage, document.supportedLocales, document.defaultLocale);
  return {
    celebrationId: document.celebrationId,
    slug: document.slug,
    locale,
    availableLocales: document.supportedLocales,
    eventType: translateType(document.eventType, locale),
    enabledSections: document.eventType.enabledSections,
    timeZone: document.timeZone,
    currency: document.currency,
    templateId: document.templateId,
    content: localisedContent(document.content, document.translations, locale),
    localTimes: localTimesOf({ ...document.content, rsvpDeadline: document.rsvpDeadline }, document.timeZone),
    rsvpDeadline: document.rsvpDeadline,
    publishedAt: document.publishedAt,
    version: row.projectionVersion
  };
}
