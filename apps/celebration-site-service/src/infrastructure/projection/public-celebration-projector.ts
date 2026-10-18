import {
  CelebrationEventType,
  type ArchivedPayload, type ConfiguredPayload, type PublishedPayload, type SettingsUpdatedPayload,
  type TemplateSelectedPayload, type TypeAssignedPayload, type UnpublishedPayload
} from '../../domain/event/celebration-events.js';
import type { EventEnvelope } from '../../domain/event/envelope.js';
import type { PublicCelebrationDocument } from '../../application/query/get-public-celebration.js';
import type { EventHistory, PublicCelebrationRow, PublicCelebrationStore, PublicStoreTransaction } from '../../application/ports.js';

/**
 * Builds `read_public_celebration` from events only (lane 15). Every payload
 * carries what the page needs, so deleting the table and replaying the event
 * history yields exactly the same rows. Consumption is idempotent by eventId
 * and ignores events older than the row (aggregate version), so duplicates and
 * out-of-order deliveries leave the projection untouched.
 */

type Handler = (store: PublicCelebrationStore, envelope: EventEnvelope) => Promise<void>;

function documentOf(row: PublicCelebrationRow): PublicCelebrationDocument {
  // Rows are written exclusively by this projector with this shape.
  return row.document as unknown as PublicCelebrationDocument;
}

function asDocument(document: PublicCelebrationDocument): Readonly<Record<string, unknown>> {
  return { ...document };
}

async function upsertFromPublished(store: PublicCelebrationStore, envelope: EventEnvelope): Promise<void> {
  // The envelope type decides the payload type; the producer is this same service.
  const payload = envelope.payload as PublishedPayload;
  const current = await store.getByCelebrationId(payload.celebration.celebrationId);
  if (current && current.projectionVersion >= payload.celebration.aggregateVersion) return;
  const c = payload.celebration;
  const document: PublicCelebrationDocument = {
    celebrationId: c.celebrationId, slug: c.slug, eventType: payload.eventType, defaultLocale: c.defaultLocale,
    supportedLocales: c.supportedLocales, timeZone: c.timeZone, currency: c.currency, templateId: c.templateId,
    content: c.content, translations: c.translations, rsvpDeadline: payload.settings.rsvpDeadline, publishedAt: c.publishedAt
  };
  await store.upsert({ slug: c.slug, celebrationId: c.celebrationId, projectionVersion: c.aggregateVersion, lastEventId: envelope.eventId, updatedAt: envelope.occurredAt, document: asDocument(document) });
}

/** Applies a change to an existing (published) row; drafts have no row and are ignored. */
async function patchRow(
  store: PublicCelebrationStore,
  envelope: EventEnvelope,
  celebrationId: string,
  aggregateVersion: number,
  change: (document: PublicCelebrationDocument) => PublicCelebrationDocument
): Promise<void> {
  const current = await store.getByCelebrationId(celebrationId);
  if (!current || current.projectionVersion >= aggregateVersion) return;
  const next = change(documentOf(current));
  await store.upsert({ ...current, slug: next.slug, projectionVersion: aggregateVersion, lastEventId: envelope.eventId, updatedAt: envelope.occurredAt, document: asDocument(next) });
}

async function removeRow(store: PublicCelebrationStore, celebrationId: string, aggregateVersion: number): Promise<void> {
  const current = await store.getByCelebrationId(celebrationId);
  if (current && current.projectionVersion < aggregateVersion) await store.deleteByCelebrationId(celebrationId);
}

const HANDLERS: Readonly<Partial<Record<string, Handler>>> = {
  [CelebrationEventType.Published]: upsertFromPublished,
  [CelebrationEventType.Configured]: async (store, envelope) => {
    const { celebration: c } = envelope.payload as ConfiguredPayload;
    await patchRow(store, envelope, c.celebrationId, c.aggregateVersion, (document) => ({
      ...document, slug: c.slug, defaultLocale: c.defaultLocale, supportedLocales: c.supportedLocales, timeZone: c.timeZone,
      currency: c.currency, templateId: c.templateId, content: c.content, translations: c.translations
    }));
  },
  [CelebrationEventType.TypeAssigned]: async (store, envelope) => {
    const payload = envelope.payload as TypeAssignedPayload;
    await patchRow(store, envelope, payload.celebration.celebrationId, payload.celebration.aggregateVersion, (document) => ({ ...document, eventType: payload.eventType }));
  },
  [CelebrationEventType.SettingsUpdated]: async (store, envelope) => {
    const payload = envelope.payload as SettingsUpdatedPayload;
    await patchRow(store, envelope, payload.celebrationId, payload.aggregateVersion, (document) => ({ ...document, rsvpDeadline: payload.rsvpDeadline }));
  },
  [CelebrationEventType.TemplateSelected]: async (store, envelope) => {
    const payload = envelope.payload as TemplateSelectedPayload;
    await patchRow(store, envelope, payload.celebrationId, payload.aggregateVersion, (document) => ({ ...document, templateId: payload.templateId }));
  },
  [CelebrationEventType.Unpublished]: async (store, envelope) => {
    const payload = envelope.payload as UnpublishedPayload;
    await removeRow(store, payload.celebrationId, payload.aggregateVersion);
  },
  [CelebrationEventType.Archived]: async (store, envelope) => {
    const payload = envelope.payload as ArchivedPayload;
    await removeRow(store, payload.celebrationId, payload.aggregateVersion);
  }
};

export const PROJECTED_EVENT_TYPES: readonly string[] = Object.keys(HANDLERS);

export class PublicCelebrationProjector {
  constructor(private readonly transactions: PublicStoreTransaction) {}

  /** Returns false when the event was a duplicate or irrelevant. */
  async apply(envelope: EventEnvelope): Promise<boolean> {
    const handler = HANDLERS[envelope.eventType];
    if (!handler) return false;
    return this.transactions.run(async (store) => {
      if (!(await store.markProcessed(envelope.eventId))) return false;
      await handler(store, envelope);
      return true;
    });
  }

  /** Drops the projection and rebuilds it from the full history, in order. */
  async replay(history: EventHistory): Promise<number> {
    const events = await history.all();
    await this.transactions.run(async (store) => store.reset());
    const applied = await events.reduce<Promise<number>>(async (count, envelope) => (await count) + Number(await this.apply(envelope)), Promise.resolve(0));
    return applied;
  }
}
