export const CONTEXTS = ['identity', 'celebration', 'guest-rsvp', 'gift-list', 'provider-catalog', 'notification', 'template-media'] as const;
export const RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000] as const;

export interface TopologyChannel {
  assertExchange(name: string, type: 'topic', options: { durable: true }): Promise<unknown>;
  assertQueue(name: string, options: { durable: true; arguments?: Record<string, unknown> }): Promise<unknown>;
  bindQueue(queue: string, exchange: string, pattern: string): Promise<unknown>;
}

export interface ConsumerTopology {
  context: string;
  consumer: string;
  pattern: string;
}

export async function declareTopology(channel: TopologyChannel, consumers: readonly ConsumerTopology[]): Promise<void> {
  for (const consumer of consumers) {
    if (!CONTEXTS.includes(consumer.context as (typeof CONTEXTS)[number])) {
      throw new Error(`Unknown messaging context: ${consumer.context}.`);
    }
  }

  await Promise.all(CONTEXTS.flatMap((context) => [
    channel.assertExchange(`${context}.events`, 'topic', { durable: true }),
    channel.assertExchange(`${context}.parking`, 'topic', { durable: true }),
    ...RETRY_DELAYS_MS.map((delay) => channel.assertExchange(`${context}.retry.${delay}`, 'topic', { durable: true }))
  ]));

  for (const context of CONTEXTS) {
    await channel.assertQueue(`${context}.parking`, { durable: true });
    await channel.bindQueue(`${context}.parking`, `${context}.parking`, '#');
    for (const delay of RETRY_DELAYS_MS) {
      const retryQueue = `${context}.retry.${delay}`;
      await channel.assertQueue(retryQueue, {
        durable: true,
        arguments: {
          'x-message-ttl': delay,
          'x-dead-letter-exchange': `${context}.events`
        }
      });
      // A separate input exchange per delay avoids routing one event to all four
      // TTL queues, while preserving the original event routing key through DLX.
      await channel.bindQueue(retryQueue, `${context}.retry.${delay}`, '#');
    }
  }

  for (const consumer of consumers) {
    const queue = `${consumer.context}.${consumer.consumer}`;
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, `${consumer.context}.events`, consumer.pattern);
  }
}
