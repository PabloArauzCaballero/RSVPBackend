import { assertEnvelope, assertRoutingKey, type EventEnvelope } from './envelope.js';

export interface ConfirmChannel {
  publish(exchange: string, routingKey: string, content: Uint8Array, options: { persistent: true; headers: Record<string, unknown> }): boolean;
  waitForConfirms(): Promise<void>;
}

export class ConfirmingPublisher {
  constructor(private readonly channel: ConfirmChannel) {}

  async publish<T>(exchange: string, envelope: EventEnvelope<T>): Promise<void> {
    assertEnvelope(envelope);
    assertRoutingKey(envelope.eventName);
    const accepted = this.channel.publish(exchange, envelope.eventName, new TextEncoder().encode(JSON.stringify(envelope)), {
      persistent: true,
      headers: { correlationId: envelope.correlationId, eventId: envelope.eventId, traceparent: envelope.traceparent ?? '' }
    });
    if (!accepted) throw new Error('Broker channel refused the message before confirmation.');
    await this.channel.waitForConfirms();
  }

  async publishBatch(exchange: string, envelopes: readonly EventEnvelope[]): Promise<void> {
    for (const envelope of envelopes) await this.publish(exchange, envelope);
  }
}
