export interface EventEnvelope<TPayload = unknown> {
  eventId: string;
  eventName: string;
  occurredAt: string;
  correlationId: string;
  tenant: { celebrationId: string };
  payload: TPayload;
  traceparent?: string;
}

export const ROUTING_KEY_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.v[1-9][0-9]*$/;

export function assertRoutingKey(routingKey: string): void {
  if (!ROUTING_KEY_PATTERN.test(routingKey)) {
    throw new Error(`Invalid routing key "${routingKey}"; expected <context>.<entity>.<fact>.v<N>.`);
  }
}

export function assertEnvelope(value: unknown): asserts value is EventEnvelope {
  if (typeof value !== 'object' || value === null) throw new Error('Event envelope must be an object.');
  const envelope = value as Partial<EventEnvelope>;
  if (!envelope.eventId || !envelope.eventName || !envelope.occurredAt || !envelope.correlationId) {
    throw new Error('Event envelope requires eventId, eventName, occurredAt and correlationId.');
  }
  assertRoutingKey(envelope.eventName);
  if (!envelope.tenant || typeof envelope.tenant.celebrationId !== 'string' || !envelope.tenant.celebrationId) {
    throw new Error('Event envelope requires tenant.celebrationId.');
  }
}
