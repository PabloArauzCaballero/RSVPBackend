export interface InboxRepository {
  claim(eventId: string): Promise<boolean>;
  release(eventId: string): Promise<void>;
}

export class InMemoryInboxRepository implements InboxRepository {
  private readonly processed = new Set<string>();
  async claim(eventId: string): Promise<boolean> {
    if (this.processed.has(eventId)) return false;
    this.processed.add(eventId);
    return true;
  }
  async release(eventId: string): Promise<void> { this.processed.delete(eventId); }
}

/** Runs a handler only once per event id; persistent adapters must enforce a unique primary key. */
export async function consumeOnce(repository: InboxRepository, eventId: string, handler: () => Promise<void>): Promise<'processed' | 'duplicate'> {
  if (!(await repository.claim(eventId))) return 'duplicate';
  try {
    await handler();
  } catch (error) {
    await repository.release(eventId);
    throw error;
  }
  return 'processed';
}
