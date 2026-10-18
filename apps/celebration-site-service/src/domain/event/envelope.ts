/**
 * The standard RSVP event envelope, field by field as `EventEnvelope` in
 * packages/contracts-asyncapi/asyncapi.yaml. The Django service builds the
 * very same shape; a cross-runtime contract test compares both.
 */

export const ActorType = { System: 'SYSTEM', User: 'USER', Guest: 'GUEST', Provider: 'PROVIDER' } as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];

export const ENVELOPE_VERSION = 1;
export const CELEBRATION_PRODUCER = 'celebration-site-service';

export interface EventEnvelope<TPayload extends object = object> {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: typeof ENVELOPE_VERSION;
  readonly occurredAt: string;
  readonly producer: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly tenant: { readonly celebrationId: string | null; readonly organizationId: string | null };
  readonly actor: { readonly type: ActorType; readonly id: string | null };
  readonly payload: TPayload;
}

export interface EnvelopeInput<TPayload extends object> {
  readonly eventId: string;
  readonly eventType: string;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly celebrationId: string | null;
  readonly organizationId: string | null;
  readonly actorId: string | null;
  readonly actorType?: ActorType;
  readonly payload: TPayload;
}

export function buildEnvelope<TPayload extends object>(input: EnvelopeInput<TPayload>): EventEnvelope<TPayload> {
  return {
    eventId: input.eventId,
    eventType: input.eventType,
    eventVersion: ENVELOPE_VERSION,
    occurredAt: input.occurredAt,
    producer: CELEBRATION_PRODUCER,
    correlationId: input.correlationId,
    ...(input.causationId ? { causationId: input.causationId } : {}),
    tenant: { celebrationId: input.celebrationId, organizationId: input.organizationId },
    actor: { type: input.actorType ?? (input.actorId ? ActorType.User : ActorType.System), id: input.actorId },
    payload: input.payload
  };
}
