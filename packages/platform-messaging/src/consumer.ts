import { assertEnvelope, type EventEnvelope } from './envelope.js';

export const RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000] as const;

export interface Delivery {
  content: Uint8Array;
  headers?: Record<string, unknown>;
}

export interface DeliveryChannel {
  ack(delivery: Delivery): void;
  retry(delivery: Delivery, delayMs: number, reason: string): Promise<void>;
  park(delivery: Delivery, reason: string): Promise<void>;
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
