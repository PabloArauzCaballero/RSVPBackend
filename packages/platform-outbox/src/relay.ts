import type { OutboxEvent, OutboxRepository } from './outbox.js';

export interface EventPublisher { publish(event: OutboxEvent): Promise<void>; }
export const DEFAULT_MAX_ATTEMPTS = 8;

export function exponentialBackoffMs(attempt: number): number {
  return Math.min(300_000, 1_000 * (2 ** Math.max(0, attempt - 1)));
}

export class OutboxRelay {
  constructor(private readonly repository: OutboxRepository, private readonly publisher: EventPublisher, private readonly maxAttempts = DEFAULT_MAX_ATTEMPTS, private readonly now = () => new Date()) {}
  async relayBatch(limit = 100): Promise<{ published: number; failed: number }> {
    const events = await this.repository.claim(limit, this.now());
    let published = 0;
    let failed = 0;
    for (const event of events) {
      try {
        await this.publisher.publish(event);
        await this.repository.markPublished(event.id);
        published += 1;
      } catch (error) {
        const attempts = event.attempts + 1;
        const reason = error instanceof Error ? error.message : 'Unknown publisher error';
        await this.repository.markForRetry(event.id, attempts, new Date(this.now().getTime() + exponentialBackoffMs(attempts)), reason, attempts >= this.maxAttempts);
        failed += 1;
      }
    }
    return { published, failed };
  }
}
