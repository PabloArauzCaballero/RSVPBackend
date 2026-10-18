import { ConflictError, InvariantError, PublishRequirementsError } from '../errors.js';
import {
  CelebrationEventType, CelebrationStatus, eventTypeSnapshot,
  type CelebrationSnapshot, type RecordedEvent
} from '../event/celebration-events.js';
import { missingFieldsForPublish } from '../policy/publish-validation.js';
import type { Collaborator, CollaboratorRole, TenantFacts } from '../policy/access.js';
import { applySettingsPatch, defaultSettings, type CelebrationSettings, type SettingsPatch } from './celebration-settings.js';
import { acceptsTemplate, EventTypeStatus, type EventTypeDefinition } from './event-type-definition.js';
import { assertCurrency, DEFAULT_CURRENCY } from './money.js';
import { assertSlug } from './slug.js';
import { assertLocale, DEFAULT_LOCALE, type TranslationMap } from './translations.js';
import { assertTimeZone, isTemporalKey, normaliseTemporal } from './zoned-time.js';

/**
 * The root aggregate of the platform (lane 10). A Celebration is any event with
 * hosts, guests, gifts and providers, and it is the tenant every other service
 * hangs from. It knows nothing about HTTP, SQL or brokers.
 */

export { CelebrationStatus };

export const DEFAULT_TIME_ZONE = 'America/La_Paz';
const MAX_CONTENT_BYTES = 262_144;
const HOSTS_KEY = 'hosts';

export interface CelebrationState {
  readonly id: string;
  readonly slug: string;
  readonly ownerId: string;
  readonly organizationId: string | null;
  readonly eventTypeCode: string;
  readonly status: CelebrationStatus;
  readonly version: number;
  readonly defaultLocale: string;
  readonly supportedLocales: readonly string[];
  readonly timeZone: string;
  readonly currency: string;
  readonly content: Readonly<Record<string, unknown>>;
  readonly translations: TranslationMap;
  readonly settings: CelebrationSettings;
  readonly templateId: string | null;
  readonly collaborators: readonly Collaborator[];
  /** First publication; once set, the slug can never change (shared links must keep working). */
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NewCelebration {
  readonly id: string;
  readonly slug: string;
  readonly ownerId: string;
  readonly organizationId?: string | null;
  readonly defaultLocale?: string;
  readonly supportedLocales?: readonly string[];
  readonly timeZone?: string;
  readonly currency?: string;
  readonly content?: Readonly<Record<string, unknown>>;
  readonly translations?: TranslationMap;
}

/** `null` removes a content key or a whole translation. */
export interface CelebrationPatch {
  readonly slug?: string;
  readonly defaultLocale?: string;
  readonly supportedLocales?: readonly string[];
  readonly timeZone?: string;
  readonly currency?: string;
  readonly content?: Readonly<Record<string, unknown>>;
  readonly translations?: Readonly<Record<string, Readonly<Record<string, unknown>> | null>>;
}

const TRANSITIONS: Readonly<Record<CelebrationStatus, readonly CelebrationStatus[]>> = {
  [CelebrationStatus.Draft]: [CelebrationStatus.Published, CelebrationStatus.Archived],
  [CelebrationStatus.Published]: [CelebrationStatus.Draft, CelebrationStatus.Archived],
  [CelebrationStatus.Archived]: []
};

/** Every `eventDate` / `*At` string, at any depth, becomes a UTC instant read in the celebration zone. */
function normaliseTemporalValues(value: unknown, timeZone: string): unknown {
  if (Array.isArray(value)) return value.map((item) => normaliseTemporalValues(item, timeZone));
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    isTemporalKey(key) && typeof nested === 'string' ? normaliseTemporal(nested, timeZone) : normaliseTemporalValues(nested, timeZone)
  ]));
}

function containsTemporalKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsTemporalKey);
  if (value === null || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, nested]) => isTemporalKey(key) || containsTemporalKey(nested));
}

function mergeRecord<TValue>(current: Readonly<Record<string, TValue>>, patch: Readonly<Record<string, TValue | null>>): Record<string, TValue> {
  const kept = Object.entries(current).filter(([key]) => !Object.hasOwn(patch, key));
  const added = Object.entries(patch).filter((entry): entry is [string, TValue] => entry[1] !== null);
  return Object.fromEntries([...kept, ...added]);
}

function assertContentSize(content: unknown): void {
  if (new TextEncoder().encode(JSON.stringify(content)).length > MAX_CONTENT_BYTES) {
    throw new InvariantError('CONTENT_TOO_LARGE', `Content must be at most ${MAX_CONTENT_BYTES} bytes`, { field: 'content' });
  }
}

function assertHosts(content: Readonly<Record<string, unknown>>, type: EventTypeDefinition): void {
  const hosts = content[HOSTS_KEY];
  if (hosts === undefined || hosts === null) return;
  if (typeof hosts !== 'object' || Array.isArray(hosts)) throw new InvariantError('INVALID_HOSTS', 'hosts must map host roles to names', { field: HOSTS_KEY });
  const unknownRoles = Object.keys(hosts).filter((role) => !type.hostRoles.includes(role));
  if (unknownRoles.length) {
    throw new InvariantError('UNKNOWN_HOST_ROLE', `${type.code} has no host roles ${unknownRoles.join(', ')}; expected ${type.hostRoles.join(', ')}`, { field: HOSTS_KEY, unknownRoles });
  }
  if (Object.values(hosts).some((name) => typeof name !== 'string')) throw new InvariantError('INVALID_HOSTS', 'Host names must be strings', { field: HOSTS_KEY });
}

function assertLocales(defaultLocale: string, supportedLocales: readonly string[]): void {
  assertLocale(defaultLocale);
  supportedLocales.forEach(assertLocale);
  if (!supportedLocales.includes(defaultLocale)) throw new InvariantError('INVALID_LOCALES', 'supportedLocales must include defaultLocale', { field: 'supportedLocales' });
  if (new Set(supportedLocales).size !== supportedLocales.length) throw new InvariantError('INVALID_LOCALES', 'supportedLocales must be unique', { field: 'supportedLocales' });
}

function assertTranslations(translations: TranslationMap, supportedLocales: readonly string[], defaultLocale: string): void {
  Object.entries(translations).forEach(([locale, overrides]) => {
    if (!supportedLocales.includes(locale)) throw new InvariantError('UNSUPPORTED_LOCALE', `${locale} is not a supported locale of this celebration`, { field: 'translations' });
    if (locale === defaultLocale) throw new InvariantError('INVALID_TRANSLATION', 'The default locale lives in content, not in translations', { field: 'translations' });
    if (containsTemporalKey(overrides)) throw new InvariantError('INVALID_TRANSLATION', 'Dates and times are not translated', { field: 'translations' });
  });
}

function assertActiveType(type: EventTypeDefinition): void {
  if (type.status !== EventTypeStatus.Active) throw new InvariantError('EVENT_TYPE_RETIRED', `${type.code} is not offered any more`, { field: 'eventTypeCode' });
}

export class Celebration {
  private current: CelebrationState;
  private recorded: RecordedEvent[] = [];
  /** Version read from storage; the repository writes only if it is still the stored one. */
  readonly loadedVersion: number;

  private constructor(state: CelebrationState, loadedVersion: number) {
    this.current = state;
    this.loadedVersion = loadedVersion;
  }

  static create(input: NewCelebration, type: EventTypeDefinition, now: string): Celebration {
    assertActiveType(type);
    const timeZone = assertTimeZone(input.timeZone ?? DEFAULT_TIME_ZONE);
    const defaultLocale = input.defaultLocale ?? DEFAULT_LOCALE;
    const supportedLocales = input.supportedLocales ?? [defaultLocale];
    assertLocales(defaultLocale, supportedLocales);
    const content = normaliseTemporalValues(input.content ?? {}, timeZone) as Readonly<Record<string, unknown>>;
    const translations = input.translations ?? {};
    assertContentSize({ content, translations });
    assertHosts(content, type);
    assertTranslations(translations, supportedLocales, defaultLocale);
    const celebration = new Celebration({
      id: input.id,
      slug: assertSlug(input.slug),
      ownerId: input.ownerId,
      organizationId: input.organizationId ?? null,
      eventTypeCode: type.code,
      status: CelebrationStatus.Draft,
      version: 1,
      defaultLocale,
      supportedLocales: [...supportedLocales],
      timeZone,
      currency: assertCurrency(input.currency ?? DEFAULT_CURRENCY),
      content,
      translations,
      settings: defaultSettings(now),
      templateId: null,
      collaborators: [],
      publishedAt: null,
      createdAt: now,
      updatedAt: now
    }, 0);
    celebration.record({ type: CelebrationEventType.Created, occurredAt: now, payload: { celebration: celebration.snapshot(), ownerId: input.ownerId, settings: celebration.current.settings } });
    return celebration;
  }

  static rehydrate(state: CelebrationState): Celebration { return new Celebration(state, state.version); }

  get state(): CelebrationState { return this.current; }
  get id(): string { return this.current.id; }
  get version(): number { return this.current.version; }
  get status(): CelebrationStatus { return this.current.status; }

  facts(): TenantFacts {
    return { ownerId: this.current.ownerId, organizationId: this.current.organizationId, collaborators: this.current.collaborators };
  }

  /** Events recorded since load, in order; calling it hands them over exactly once. */
  pullEvents(): RecordedEvent[] {
    const events = this.recorded;
    this.recorded = [];
    return events;
  }

  snapshot(): CelebrationSnapshot {
    const s = this.current;
    return {
      celebrationId: s.id, slug: s.slug, status: s.status, eventTypeCode: s.eventTypeCode, organizationId: s.organizationId,
      defaultLocale: s.defaultLocale, supportedLocales: s.supportedLocales, timeZone: s.timeZone, currency: s.currency,
      templateId: s.templateId, content: s.content, translations: s.translations, publishedAt: s.publishedAt, aggregateVersion: s.version,
      ownerId: s.ownerId, collaborators: s.collaborators
    };
  }

  /** Optimistic lock at the domain boundary: a stale If-Match never reaches a mutation. */
  assertVersion(expected: number): void {
    if (expected !== this.current.version) {
      throw new ConflictError('VERSION_CONFLICT', `Celebration is at version ${this.current.version}, not ${expected}; reload and retry`, { currentVersion: this.current.version });
    }
  }

  edit(patch: CelebrationPatch, type: EventTypeDefinition, now: string): void {
    this.assertNotArchived();
    const s = this.current;
    if (patch.slug !== undefined && patch.slug !== s.slug && s.publishedAt !== null) {
      throw new ConflictError('SLUG_IMMUTABLE', 'The slug cannot change once the celebration has been published', { field: 'slug' });
    }
    const timeZone = patch.timeZone === undefined ? s.timeZone : assertTimeZone(patch.timeZone);
    const defaultLocale = patch.defaultLocale ?? s.defaultLocale;
    const supportedLocales = patch.supportedLocales ?? (patch.defaultLocale && !s.supportedLocales.includes(patch.defaultLocale) ? [...s.supportedLocales, patch.defaultLocale] : s.supportedLocales);
    assertLocales(defaultLocale, supportedLocales);
    const content = patch.content === undefined ? s.content : mergeRecord(s.content, normaliseTemporalValues(patch.content, timeZone) as Readonly<Record<string, unknown>>);
    const translations = patch.translations === undefined ? s.translations : mergeRecord<Readonly<Record<string, unknown>>>(s.translations, patch.translations);
    assertContentSize({ content, translations });
    // Hosts are checked when edited; after a type change the old ones stay until the host replaces them.
    if (patch.content && Object.hasOwn(patch.content, HOSTS_KEY)) assertHosts(content, type);
    assertTranslations(translations, supportedLocales, defaultLocale);
    const next: CelebrationState = {
      ...s,
      slug: patch.slug === undefined ? s.slug : assertSlug(patch.slug),
      timeZone,
      defaultLocale,
      supportedLocales: [...supportedLocales],
      currency: patch.currency === undefined ? s.currency : assertCurrency(patch.currency),
      content,
      translations
    };
    const changedFields = (Object.keys(next) as (keyof CelebrationState)[]).filter((key) => JSON.stringify(next[key]) !== JSON.stringify(s[key]));
    if (!changedFields.length) return;
    this.apply(next, now);
    this.record({ type: CelebrationEventType.Configured, occurredAt: now, payload: { celebration: this.snapshot(), changedFields } });
  }

  /** Changing the type keeps every byte of content; the new type's rules apply at publish time. */
  assignType(type: EventTypeDefinition, now: string): void {
    this.assertStatus(CelebrationStatus.Draft, 'The event type can only change while the celebration is a draft');
    assertActiveType(type);
    const previous = this.current.eventTypeCode;
    if (previous === type.code) return;
    this.apply({ ...this.current, eventTypeCode: type.code }, now);
    this.record({ type: CelebrationEventType.TypeAssigned, occurredAt: now, payload: { celebration: this.snapshot(), previousEventTypeCode: previous, eventType: eventTypeSnapshot(type) } });
  }

  /** Returns false when nothing changed; no event is emitted then. */
  changeSettings(patch: SettingsPatch, now: string): boolean {
    this.assertNotArchived();
    const change = applySettingsPatch(this.current.settings, patch, now, this.current.timeZone);
    if (!change.changedFields.length) return false;
    this.apply({ ...this.current, settings: change.settings }, now);
    const s = this.current;
    this.record({
      type: CelebrationEventType.SettingsUpdated,
      occurredAt: now,
      payload: { ...change.settings, celebrationId: s.id, timeZone: s.timeZone, defaultLocale: s.defaultLocale, changedFields: change.changedFields, aggregateVersion: s.version }
    });
    return true;
  }

  /** Lists the fields the type still requires; empty means the celebration can be published. */
  publishReadiness(type: EventTypeDefinition): string[] { return missingFieldsForPublish(this.current.content, type); }

  publish(type: EventTypeDefinition, now: string): void {
    this.assertTransition(CelebrationStatus.Published);
    if (type.code !== this.current.eventTypeCode) throw new InvariantError('EVENT_TYPE_MISMATCH', 'Publish must validate against the celebration own type');
    const missing = missingFieldsForPublish(this.current.content, type);
    if (missing.length) throw new PublishRequirementsError(missing);
    this.apply({ ...this.current, status: CelebrationStatus.Published, publishedAt: this.current.publishedAt ?? now }, now);
    this.record({ type: CelebrationEventType.Published, occurredAt: now, payload: { celebration: this.snapshot(), eventType: eventTypeSnapshot(type), settings: this.current.settings } });
  }

  unpublish(reason: string | null, now: string): void {
    this.assertTransition(CelebrationStatus.Draft);
    this.apply({ ...this.current, status: CelebrationStatus.Draft }, now);
    this.record({ type: CelebrationEventType.Unpublished, occurredAt: now, payload: { celebrationId: this.id, slug: this.current.slug, aggregateVersion: this.version, reason } });
  }

  archive(now: string): void {
    const previousStatus = this.current.status;
    this.assertTransition(CelebrationStatus.Archived);
    this.apply({ ...this.current, status: CelebrationStatus.Archived }, now);
    this.record({ type: CelebrationEventType.Archived, occurredAt: now, payload: { celebrationId: this.id, slug: this.current.slug, aggregateVersion: this.version, previousStatus } });
  }

  /** Switching templates only swaps the reference: content and translations stay byte-identical. */
  selectTemplate(templateId: string, templateTags: readonly string[], type: EventTypeDefinition, now: string): void {
    this.assertNotArchived();
    if (!acceptsTemplate(type, templateTags)) {
      throw new InvariantError('INCOMPATIBLE_TEMPLATE', `Template is not compatible with ${type.code}`, { field: 'templateId', compatibleTemplateTags: [...type.compatibleTemplateTags] });
    }
    const previousTemplateId = this.current.templateId;
    if (previousTemplateId === templateId) return;
    this.apply({ ...this.current, templateId }, now);
    this.record({ type: CelebrationEventType.TemplateSelected, occurredAt: now, payload: { celebrationId: this.id, templateId, previousTemplateId, aggregateVersion: this.version } });
  }

  setCollaborator(userId: string, role: CollaboratorRole | null, now: string): void {
    this.assertNotArchived();
    if (userId === this.current.ownerId) throw new InvariantError('OWNER_IS_NOT_COLLABORATOR', 'The owner already manages the celebration', { field: 'userId' });
    const others = this.current.collaborators.filter((collaborator) => collaborator.userId !== userId);
    const collaborators = role === null ? others : [...others, { userId, role }];
    if (JSON.stringify(collaborators) === JSON.stringify(this.current.collaborators)) return;
    this.apply({ ...this.current, collaborators }, now);
    this.record({ type: CelebrationEventType.Configured, occurredAt: now, payload: { celebration: this.snapshot(), changedFields: ['collaborators'] } });
  }

  private apply(next: CelebrationState, now: string): void {
    this.current = { ...next, version: this.current.version + 1, updatedAt: now };
  }

  private record(event: RecordedEvent): void { this.recorded = [...this.recorded, event]; }

  private assertNotArchived(): void {
    if (this.current.status === CelebrationStatus.Archived) throw new ConflictError('CELEBRATION_ARCHIVED', 'Archived celebrations are read-only');
  }

  private assertStatus(expected: CelebrationStatus, message: string): void {
    if (this.current.status !== expected) throw new ConflictError('INVALID_TRANSITION', message, { status: this.current.status });
  }

  private assertTransition(target: CelebrationStatus): void {
    if (!TRANSITIONS[this.current.status].includes(target)) {
      throw new ConflictError('INVALID_TRANSITION', `Cannot go from ${this.current.status} to ${target}`, { status: this.current.status, target });
    }
  }
}
