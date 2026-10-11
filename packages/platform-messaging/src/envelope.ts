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
  const { eventId, eventName, occurredAt, correlationId } = envelope;
  if ([eventId, eventName, occurredAt, correlationId].some((field) => typeof field !== 'string' || field.trim().length === 0)) {
    throw new Error('Event envelope requires eventId, eventName, occurredAt and correlationId.');
  }
  // TypeScript cannot infer narrowing through Array#some, although the guard above
  // establishes that all four fields are non-empty strings.
  if (typeof occurredAt !== 'string' || typeof eventName !== 'string') throw new Error('Invalid event envelope.');
  if (!Number.isFinite(Date.parse(occurredAt))) throw new Error('Event envelope occurredAt must be an ISO date-time.');
  assertRoutingKey(eventName);
  if (!envelope.tenant || typeof envelope.tenant.celebrationId !== 'string' || !envelope.tenant.celebrationId.trim()) {
    throw new Error('Event envelope requires tenant.celebrationId.');
  }
  if (!Object.hasOwn(envelope, 'payload') || envelope.payload === undefined) throw new Error('Event envelope requires payload.');
}
