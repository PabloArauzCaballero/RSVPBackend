export const CONTEXTS = ['identity', 'celebration', 'guest-rsvp', 'gift-list', 'provider-catalog', 'notification', 'template-media'] as const;

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
  await Promise.all(CONTEXTS.map((context) => channel.assertExchange(`${context}.events`, 'topic', { durable: true })));
  for (const consumer of consumers) {
    const queue = `${consumer.context}.${consumer.consumer}`;
    await channel.assertQueue(queue, { durable: true, arguments: { 'x-dead-letter-exchange': `${consumer.context}.retry` } });
    await channel.assertQueue(`${queue}.parking`, { durable: true });
    await channel.bindQueue(queue, `${consumer.context}.events`, consumer.pattern);
  }
}
