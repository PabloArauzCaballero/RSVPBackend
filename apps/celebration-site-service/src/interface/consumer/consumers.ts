import { recordTemplateReference } from '../../application/command/admin-reference-data.js';
import type { ApplicationDeps } from '../../application/command/command-runner.js';
import type { EventEnvelope } from '../../domain/event/envelope.js';
import { TemplateStatus } from '../../domain/port/reference-data.js';
import { PROJECTED_EVENT_TYPES, type PublicCelebrationProjector } from '../../infrastructure/projection/public-celebration-projector.js';
import { CELEBRATION_EXCHANGE, TEMPLATE_MEDIA_EXCHANGE, type ConsumerSpec } from '../../infrastructure/messaging/amqp.js';

/** Template/Media events this service listens to (see template-media-service/outbox). */
export const TemplateEventType = {
  Published: 'template.template.published.v1',
  Archived: 'template.template.archived.v1'
} as const;

interface TemplatePayload {
  readonly templateId?: unknown;
  readonly eventTypeTags?: unknown;
}

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

/** Keeps `template_reference` current: what can be selected and for which event types. */
export function templateCatalogHandler(deps: ApplicationDeps): (envelope: EventEnvelope) => Promise<void> {
  return async (envelope) => {
    // Payload fields are checked one by one below before use.
    const payload = envelope.payload as TemplatePayload;
    if (typeof payload.templateId !== 'string') throw new Error(`${envelope.eventType} without templateId`);
    const tags = isStringArray(payload.eventTypeTags) ? payload.eventTypeTags : [];
    const status = envelope.eventType === TemplateEventType.Published ? TemplateStatus.Published : TemplateStatus.Archived;
    await recordTemplateReference(deps, { templateId: payload.templateId, tags, status });
  };
}

export const DEFAULT_QUEUE_PREFIX = 'celebration';

/** Queue names are `<prefix>.<consumer>`; two deployments sharing a broker must use different prefixes. */
export function consumerSpecs(deps: ApplicationDeps, projector: PublicCelebrationProjector, queuePrefix = DEFAULT_QUEUE_PREFIX): readonly ConsumerSpec[] {
  return [
    { queue: `${queuePrefix}.public-site-projection`, exchange: CELEBRATION_EXCHANGE, routingKeys: PROJECTED_EVENT_TYPES, handler: async (envelope) => projector.apply(envelope) },
    { queue: `${queuePrefix}.template-catalog`, exchange: TEMPLATE_MEDIA_EXCHANGE, routingKeys: Object.values(TemplateEventType), handler: templateCatalogHandler(deps) }
  ];
}
