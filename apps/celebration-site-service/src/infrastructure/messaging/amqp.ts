import amqp from 'amqplib';
import type { EventEnvelope } from '../../domain/event/envelope.js';
import type { EnvelopePublisher } from './outbox-relay.js';

/**
 * RabbitMQ adapter. Exchanges follow the platform topology (`<context>.events`,
 * topic, durable) and routing keys are the contract event types.
 */

export const CELEBRATION_EXCHANGE = 'celebration.events';
export const TEMPLATE_MEDIA_EXCHANGE = 'template-media.events';
const PARKING_SUFFIX = '.parking';
const JSON_CONTENT = 'application/json';
const MAX_HANDLER_ATTEMPTS = 3;
const RETRY_BASE_MS = 200;

export type EnvelopeHandler = (envelope: EventEnvelope) => Promise<unknown>;

export interface ConsumerSpec {
  readonly queue: string;
  readonly exchange: string;
  readonly routingKeys: readonly string[];
  readonly handler: EnvelopeHandler;
  /** Exclusive, auto-deleted queues for tests and throw-away environments. */
  readonly ephemeral?: boolean;
}

export interface AmqpLogger {
  info(message: string, fields: Readonly<Record<string, unknown>>): void;
  error(message: string, fields: Readonly<Record<string, unknown>>): void;
}

const sleep = async (ms: number): Promise<void> => { await new Promise((resolve) => setTimeout(resolve, ms)); };

async function withRetries(work: () => Promise<unknown>, attempt = 1): Promise<void> {
  try {
    await work();
  } catch (error) {
    if (attempt >= MAX_HANDLER_ATTEMPTS) throw error;
    await sleep(RETRY_BASE_MS * attempt);
    await withRetries(work, attempt + 1);
  }
}

const RECONNECT_MS = 2_000;
const DEFAULT_CONNECTION_NAME = 'celebration-site-service';

interface Link { readonly connection: amqp.ChannelModel; readonly channel: amqp.ConfirmChannel }

/**
 * Connection that survives broker restarts: when RabbitMQ drops it, it reconnects with a
 * pause and declares every consumer again. While disconnected, publish fails, so the outbox
 * relay keeps the events pending and retries them.
 */
export class AmqpBroker implements EnvelopePublisher {
  private link: Link | undefined;
  private consumers: readonly ConsumerSpec[] = [];
  private closing = false;

  private constructor(private readonly url: string, private readonly logger: AmqpLogger, private readonly name: string) {}

  /** `name` shows in the RabbitMQ management UI (connection_name), so operators can tell instances apart. */
  static async connect(url: string, logger: AmqpLogger, name = DEFAULT_CONNECTION_NAME): Promise<AmqpBroker> {
    const broker = new AmqpBroker(url, logger, name);
    await broker.open();
    return broker;
  }

  private async open(): Promise<void> {
    const connection = await amqp.connect(this.url, { clientProperties: { connection_name: this.name } });
    const channel = await connection.createConfirmChannel();
    await channel.assertExchange(CELEBRATION_EXCHANGE, 'topic', { durable: true });
    await channel.assertExchange(TEMPLATE_MEDIA_EXCHANGE, 'topic', { durable: true });
    connection.on('error', (error: Error) => this.logger.error('broker connection error', { error: error.message }));
    connection.on('close', () => { this.link = undefined; if (!this.closing) void this.reconnect(); });
    this.link = { connection, channel };
    await Promise.all(this.consumers.map(async (spec) => this.declare(channel, spec)));
  }

  private async reconnect(): Promise<void> {
    await sleep(RECONNECT_MS);
    try {
      await this.open();
      this.logger.info('broker reconnected', { consumers: this.consumers.length });
    } catch (error) {
      this.logger.error('broker reconnect failed', { error: error instanceof Error ? error.message : String(error) });
      if (!this.closing) await this.reconnect();
    }
  }

  private channel(): amqp.ConfirmChannel {
    if (!this.link) throw new Error('Broker is reconnecting');
    return this.link.channel;
  }

  /** Persistent publish that resolves only after the broker confirms it. */
  async publish(envelope: EventEnvelope): Promise<void> {
    await this.publishTo(CELEBRATION_EXCHANGE, envelope.eventType, envelope);
  }

  async publishTo(exchange: string, routingKey: string, envelope: EventEnvelope): Promise<void> {
    const channel = this.channel();
    channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(envelope)), {
      persistent: true, contentType: JSON_CONTENT, messageId: envelope.eventId, correlationId: envelope.correlationId,
      headers: { eventId: envelope.eventId, correlationId: envelope.correlationId }
    });
    await channel.waitForConfirms();
  }

  /**
   * Durable queue bound to the given routing keys, declared again after every reconnection.
   * A handler failing three times parks the message in `<queue>.parking` instead of blocking the queue.
   */
  async consume(spec: ConsumerSpec): Promise<void> {
    this.consumers = [...this.consumers, spec];
    await this.declare(this.channel(), spec);
  }

  private async declare(channel: amqp.ConfirmChannel, spec: ConsumerSpec): Promise<void> {
    const parking = `${spec.queue}${PARKING_SUFFIX}`;
    const options = spec.ephemeral ? { durable: false, exclusive: true, autoDelete: true } : { durable: true };
    await channel.assertQueue(spec.queue, options);
    await channel.assertQueue(parking, options);
    await Promise.all(spec.routingKeys.map(async (key) => channel.bindQueue(spec.queue, spec.exchange, key)));
    await channel.consume(spec.queue, (message) => {
      if (!message) return;
      void (async () => {
        try {
          // Messages on these exchanges are contract envelopes; the handler validates what it reads.
          const envelope = JSON.parse(message.content.toString('utf8')) as EventEnvelope;
          await withRetries(async () => spec.handler(envelope));
        } catch (error) {
          this.logger.error('message parked', { queue: spec.queue, messageId: message.properties.messageId, error: error instanceof Error ? error.message : String(error) });
          channel.sendToQueue(parking, message.content, { persistent: true, contentType: JSON_CONTENT, headers: message.properties.headers ?? {} });
        } finally {
          channel.ack(message);
        }
      })();
    });
    this.logger.info('consumer started', { queue: spec.queue, exchange: spec.exchange });
  }

  async close(): Promise<void> {
    this.closing = true;
    const link = this.link;
    this.link = undefined;
    if (!link) return;
    await link.channel.close();
    await link.connection.close();
  }
}

/** Broker-less delivery for development and tests: the same handlers, called after commit. */
export class InProcessBus implements EnvelopePublisher {
  private handlers: readonly { readonly routingKeys: readonly string[]; readonly handler: EnvelopeHandler }[] = [];
  subscribe(routingKeys: readonly string[], handler: EnvelopeHandler): void { this.handlers = [...this.handlers, { routingKeys, handler }]; }
  async publish(envelope: EventEnvelope): Promise<void> {
    await Promise.all(this.handlers.filter((entry) => entry.routingKeys.includes(envelope.eventType)).map(async (entry) => entry.handler(envelope)));
  }
}
