import { assertEnvelope, type EventEnvelope } from './envelope.js';
import { RETRY_DELAYS_MS } from './topology.js';

export { RETRY_DELAYS_MS } from './topology.js';

export interface Delivery {
  content: Uint8Array;
  headers?: Record<string, unknown>;
}

export interface DeliveryChannel {
  ack(delivery: Delivery): void;
  retry(delivery: Delivery, delayMs: number, reason: string): Promise<void>;
  park(delivery: Delivery, reason: string): Promise<void>;
}

/** Minimal AMQP-channel shape used by the concrete retry/DLX adapter. */
export interface RabbitMqRetryChannel {
  ack(delivery: Delivery): void;
  publish(exchange: string, routingKey: string, content: Uint8Array, options: { persistent: true; headers: Record<string, unknown> }): boolean;
  waitForConfirms(): Promise<void>;
}

/**
 * Creates delivery actions backed by the declared retry and parking exchanges.
 * A retry is acknowledged only after its republish has been broker-confirmed;
 * TTL queues then dead-letter it back to the events exchange with its routing key.
 */
export function createRabbitMqDeliveryChannel(channel: RabbitMqRetryChannel, context: string): DeliveryChannel {
  async function republish(exchange: string, delivery: Delivery, reason: string, attempt?: number): Promise<void> {
    const event = JSON.parse(new TextDecoder().decode(delivery.content)) as EventEnvelope;
    assertEnvelope(event);
    const headers: Record<string, unknown> = {
      ...(delivery.headers ?? {}),
      'x-rsvp-reason': reason
    };
    if (attempt !== undefined) headers['x-rsvp-attempt'] = attempt;
    if (!channel.publish(exchange, event.eventName, delivery.content, { persistent: true, headers })) {
      throw new Error(`Broker channel refused republish to ${exchange}.`);
    }
    await channel.waitForConfirms();
    channel.ack(delivery);
  }

  return {
    ack: (delivery) => channel.ack(delivery),
    retry: (delivery, delayMs, reason) => {
      if (!RETRY_DELAYS_MS.includes(delayMs as (typeof RETRY_DELAYS_MS)[number])) {
        throw new Error(`Unsupported retry delay: ${delayMs}.`);
      }
      return republish(`${context}.retry.${delayMs}`, delivery, reason, Number(delivery.headers?.['x-rsvp-attempt'] ?? 0) + 1);
    },
    park: (delivery, reason) => republish(`${context}.parking`, delivery, reason)
  };
}

export type EventHandler = (event: EventEnvelope) => Promise<void>;

export class ManualAckConsumer {
  readonly prefetch = 10;
  constructor(private readonly channel: DeliveryChannel, private readonly handler: EventHandler) {}

  async consume(delivery: Delivery): Promise<void> {
    try {
      const event = JSON.parse(new TextDecoder().decode(delivery.content)) as unknown;
      assertEnvelope(event);
      await this.handler(event);
      this.channel.ack(delivery);
    } catch (error) {
      const attempts = Number(delivery.headers?.['x-rsvp-attempt'] ?? 0) + 1;
      const reason = error instanceof Error ? error.message : 'Unknown consumer error';
      if (attempts <= RETRY_DELAYS_MS.length) {
        await this.channel.retry(delivery, RETRY_DELAYS_MS[attempts - 1], reason);
      } else {
        await this.channel.park(delivery, reason);
      }
    }
  }
}
