import type { CelebrationSettings } from '../model/celebration-settings.js';
import type { EventTypeDefinition, EventTypeTranslation, SectionId } from '../model/event-type-definition.js';
import type { TranslationMap } from '../model/translations.js';
import type { Collaborator } from '../policy/access.js';

/** Routing keys published by this service; all are channels in the AsyncAPI catalog. */
export const CelebrationEventType = {
  Created: 'celebration.celebration.created.v1',
  TypeAssigned: 'celebration.celebration.type-assigned.v1',
  Configured: 'celebration.celebration.configured.v1',
  SettingsUpdated: 'celebration.settings.updated.v1',
  Published: 'celebration.celebration.published.v1',
  Unpublished: 'celebration.celebration.unpublished.v1',
  Archived: 'celebration.celebration.archived.v1',
  TemplateSelected: 'celebration.template.selected.v1'
} as const;
export type CelebrationEventType = (typeof CelebrationEventType)[keyof typeof CelebrationEventType];

export const CelebrationStatus = { Draft: 'DRAFT', Published: 'PUBLISHED', Archived: 'ARCHIVED' } as const;
export type CelebrationStatus = (typeof CelebrationStatus)[keyof typeof CelebrationStatus];

/** Everything the public site needs, so a projection can be rebuilt from events alone. */
export interface CelebrationSnapshot {
  readonly celebrationId: string;
  readonly slug: string;
  readonly status: CelebrationStatus;
  readonly eventTypeCode: string;
  readonly organizationId: string | null;
  readonly defaultLocale: string;
  readonly supportedLocales: readonly string[];
  readonly timeZone: string;
  readonly currency: string;
  readonly templateId: string | null;
  readonly content: Readonly<Record<string, unknown>>;
  readonly translations: TranslationMap;
  readonly publishedAt: string | null;
  readonly aggregateVersion: number;
  /** Who else may act on it; Template/Media authorises uploads from this. Never projected publicly. */
  readonly ownerId: string;
  readonly collaborators: readonly Collaborator[];
}

export interface EventTypeSnapshot {
  readonly code: string;
  readonly defaultLocale: string;
  readonly hostRoles: readonly string[];
  readonly enabledSections: readonly SectionId[];
  readonly translations: readonly EventTypeTranslation[];
}

export function eventTypeSnapshot(type: EventTypeDefinition): EventTypeSnapshot {
  return { code: type.code, defaultLocale: type.defaultLocale, hostRoles: type.hostRoles, enabledSections: type.enabledSections, translations: type.translations };
}

export interface CreatedPayload { readonly celebration: CelebrationSnapshot; readonly ownerId: string; readonly settings: CelebrationSettings }
export interface TypeAssignedPayload { readonly celebration: CelebrationSnapshot; readonly previousEventTypeCode: string; readonly eventType: EventTypeSnapshot }
export interface ConfiguredPayload { readonly celebration: CelebrationSnapshot; readonly changedFields: readonly string[] }
export interface PublishedPayload { readonly celebration: CelebrationSnapshot; readonly eventType: EventTypeSnapshot; readonly settings: CelebrationSettings }
export interface UnpublishedPayload { readonly celebrationId: string; readonly slug: string; readonly aggregateVersion: number; readonly reason: string | null }
export interface ArchivedPayload { readonly celebrationId: string; readonly slug: string; readonly aggregateVersion: number; readonly previousStatus: CelebrationStatus }
export interface TemplateSelectedPayload { readonly celebrationId: string; readonly templateId: string; readonly previousTemplateId: string | null; readonly aggregateVersion: number }

/**
 * `CelebrationSettingsUpdated.v1`: flat on purpose; Guest/RSVP and Gift List read
 * the switch they care about without walking a tree. `effectiveFrom` is what
 * makes the change non-retroactive for them.
 */
export interface SettingsUpdatedPayload extends CelebrationSettings {
  readonly celebrationId: string;
  readonly timeZone: string;
  readonly defaultLocale: string;
  readonly changedFields: readonly string[];
  readonly aggregateVersion: number;
}

export interface PayloadByType {
  readonly [CelebrationEventType.Created]: CreatedPayload;
  readonly [CelebrationEventType.TypeAssigned]: TypeAssignedPayload;
  readonly [CelebrationEventType.Configured]: ConfiguredPayload;
  readonly [CelebrationEventType.SettingsUpdated]: SettingsUpdatedPayload;
  readonly [CelebrationEventType.Published]: PublishedPayload;
  readonly [CelebrationEventType.Unpublished]: UnpublishedPayload;
  readonly [CelebrationEventType.Archived]: ArchivedPayload;
  readonly [CelebrationEventType.TemplateSelected]: TemplateSelectedPayload;
}

export type RecordedEvent = {
  readonly [K in CelebrationEventType]: { readonly type: K; readonly occurredAt: string; readonly payload: PayloadByType[K] }
}[CelebrationEventType];
