export interface InboxRepository { claim(eventId: string): Promise<boolean>; }

export class InMemoryInboxRepository implements InboxRepository {
  private readonly processed = new Set<string>();
  async claim(eventId: string): Promise<boolean> {
    if (this.processed.has(eventId)) return false;
    this.processed.add(eventId);
    return true;
  }
}

/** Runs a handler only once per event id; persistent adapters must enforce a unique primary key. */
export async function consumeOnce(repository: InboxRepository, eventId: string, handler: () => Promise<void>): Promise<'processed' | 'duplicate'> {
  if (!(await repository.claim(eventId))) return 'duplicate';
  await handler();
  return 'processed';
}
