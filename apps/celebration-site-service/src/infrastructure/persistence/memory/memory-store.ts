import { ConflictError } from '../../../domain/errors.js';
import type { EventEnvelope } from '../../../domain/event/envelope.js';
import { Celebration, type CelebrationState } from '../../../domain/model/celebration.js';
import type { EventTypeDefinition } from '../../../domain/model/event-type-definition.js';
import type { AccessScope } from '../../../domain/policy/access.js';
import type { CelebrationRepository, Page } from '../../../domain/port/celebration-repository.js';
import type { EventTypeRepository, TemplateCatalog, TemplateReference } from '../../../domain/port/reference-data.js';
import type {
  AuditEntry, AuditLog, EventHistory, OutboxWriter, PublicCelebrationRow, PublicCelebrationStore,
  PublicSlug, PublicStoreTransaction, TransactionContext, UnitOfWork
} from '../../../application/ports.js';

/**
 * In-memory adapters with the same guarantees as the Postgres ones: a
 * transaction works on a copy and commits atomically, transactions are
 * serialised, and reads are filtered by the same predicate as the RLS policy.
 */

interface Tables {
  readonly celebrations: Map<string, CelebrationState>;
  readonly eventTypes: Map<string, EventTypeDefinition>;
  readonly templates: Map<string, TemplateReference>;
  readonly outbox: EventEnvelope[];
  readonly audit: AuditEntry[];
  readonly publicRows: Map<string, PublicCelebrationRow>;
  readonly processed: Set<string>;
}

const emptyTables = (): Tables => ({
  celebrations: new Map(), eventTypes: new Map(), templates: new Map(), outbox: [], audit: [], publicRows: new Map(), processed: new Set()
});

/** The predicate of `celebration_tenant_policy` in 0001_celebration_core.up.sql. */
export function visibleTo(state: CelebrationState, scope: AccessScope): boolean {
  return scope.admin
    || state.ownerId === scope.userId
    || (state.organizationId !== null && scope.organizationIds.includes(state.organizationId))
    || state.collaborators.some((collaborator) => collaborator.userId === scope.userId);
}

class MemoryCelebrationRepository implements CelebrationRepository {
  constructor(private readonly tables: Tables) {}
  async findById(scope: AccessScope, celebrationId: string): Promise<Celebration | undefined> {
    const state = this.tables.celebrations.get(celebrationId);
    return state && visibleTo(state, scope) ? Celebration.rehydrate(structuredClone(state)) : undefined;
  }
  async list(scope: AccessScope, page: Page): Promise<readonly Celebration[]> {
    return [...this.tables.celebrations.values()]
      .filter((state) => visibleTo(state, scope))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
      .slice(page.offset, page.offset + page.limit)
      .map((state) => Celebration.rehydrate(structuredClone(state)));
  }
  async insert(celebration: Celebration): Promise<void> {
    const state = celebration.state;
    if (this.slugInUse(state.slug, state.id) || this.tables.celebrations.has(state.id)) throw new ConflictError('SLUG_TAKEN', `Slug "${state.slug}" is already in use`, { field: 'slug' });
    this.tables.celebrations.set(state.id, structuredClone(state));
  }
  async update(celebration: Celebration): Promise<void> {
    const state = celebration.state;
    const stored = this.tables.celebrations.get(state.id);
    if (!stored || stored.version !== celebration.loadedVersion) throw new ConflictError('VERSION_CONFLICT', 'Celebration was changed by someone else; reload and retry');
    if (this.slugInUse(state.slug, state.id)) throw new ConflictError('SLUG_TAKEN', `Slug "${state.slug}" is already in use`, { field: 'slug' });
    this.tables.celebrations.set(state.id, structuredClone(state));
  }
  private slugInUse(slug: string, ownId: string): boolean {
    return [...this.tables.celebrations.values()].some((state) => state.slug === slug && state.id !== ownId);
  }
}

class MemoryEventTypes implements EventTypeRepository {
  constructor(private readonly tables: Tables) {}
  async get(code: string): Promise<EventTypeDefinition | undefined> { return this.tables.eventTypes.get(code); }
  async list(): Promise<readonly EventTypeDefinition[]> { return [...this.tables.eventTypes.values()].sort((a, b) => a.code.localeCompare(b.code)); }
  async upsert(definition: EventTypeDefinition): Promise<boolean> {
    const created = !this.tables.eventTypes.has(definition.code);
    this.tables.eventTypes.set(definition.code, definition);
    return created;
  }
}

class MemoryTemplates implements TemplateCatalog {
  constructor(private readonly tables: Tables) {}
  async get(templateId: string): Promise<TemplateReference | undefined> { return this.tables.templates.get(templateId); }
  async upsert(reference: TemplateReference): Promise<void> { this.tables.templates.set(reference.templateId, reference); }
}

class MemoryOutbox implements OutboxWriter {
  constructor(private readonly tables: Tables) {}
  async append(envelope: EventEnvelope): Promise<void> { this.tables.outbox.push(structuredClone(envelope)); }
}

class MemoryAudit implements AuditLog {
  constructor(private readonly tables: Tables) {}
  async append(entry: AuditEntry): Promise<void> { this.tables.audit.push(structuredClone(entry)); }
  async list(celebrationId: string): Promise<readonly AuditEntry[]> { return this.tables.audit.filter((entry) => entry.celebrationId === celebrationId); }
}

class MemoryPublicStore implements PublicCelebrationStore {
  constructor(private readonly tables: Tables) {}
  async getBySlug(slug: string): Promise<PublicCelebrationRow | undefined> { return this.tables.publicRows.get(slug); }
  async getByCelebrationId(celebrationId: string): Promise<PublicCelebrationRow | undefined> {
    return [...this.tables.publicRows.values()].find((row) => row.celebrationId === celebrationId);
  }
  async upsert(row: PublicCelebrationRow): Promise<void> {
    const previous = await this.getByCelebrationId(row.celebrationId);
    if (previous) this.tables.publicRows.delete(previous.slug);
    this.tables.publicRows.set(row.slug, structuredClone(row));
  }
  async deleteByCelebrationId(celebrationId: string): Promise<void> {
    const previous = await this.getByCelebrationId(celebrationId);
    if (previous) this.tables.publicRows.delete(previous.slug);
  }
  async markProcessed(eventId: string): Promise<boolean> {
    if (this.tables.processed.has(eventId)) return false;
    this.tables.processed.add(eventId);
    return true;
  }
  async reset(): Promise<void> { this.tables.publicRows.clear(); this.tables.processed.clear(); }
  async dump(): Promise<readonly PublicCelebrationRow[]> {
    return [...this.tables.publicRows.values()].sort((a, b) => a.slug.localeCompare(b.slug)).map((row) => structuredClone(row));
  }
  async listSlugs(limit: number, offset: number): Promise<readonly PublicSlug[]> {
    return [...this.tables.publicRows.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.slug.localeCompare(b.slug))
      .slice(offset, offset + limit)
      .map((row) => ({ slug: row.slug, updatedAt: row.updatedAt, supportedLocales: localesOf(row) }));
  }
}

const SUPPORTED_LOCALES_KEY = 'supportedLocales';

/** The projector always stores supportedLocales as a string array in the document. */
export function localesOf(row: PublicCelebrationRow): readonly string[] {
  const value = row.document[SUPPORTED_LOCALES_KEY];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

const copyTables = (tables: Tables): Tables => ({
  celebrations: structuredClone(tables.celebrations), eventTypes: new Map(tables.eventTypes), templates: new Map(tables.templates),
  outbox: [...tables.outbox], audit: [...tables.audit], publicRows: structuredClone(tables.publicRows), processed: new Set(tables.processed)
});

export type CommitListener = (committed: readonly EventEnvelope[]) => void;

export class MemoryDatabase implements UnitOfWork, EventHistory {
  private tables: Tables = emptyTables();
  private queue: Promise<unknown> = Promise.resolve();
  private listeners: readonly CommitListener[] = [];

  /** Called after every commit with the events it appended, like a relay would deliver them. */
  onCommit(listener: CommitListener): void { this.listeners = [...this.listeners, listener]; }

  async run<TResult>(_scope: AccessScope, work: (tx: TransactionContext) => Promise<TResult>): Promise<TResult> {
    return this.serialised(async () => {
      const draft = copyTables(this.tables);
      const before = this.tables.outbox.length;
      const result = await work({
        celebrations: new MemoryCelebrationRepository(draft), eventTypes: new MemoryEventTypes(draft), templates: new MemoryTemplates(draft),
        outbox: new MemoryOutbox(draft), audit: new MemoryAudit(draft)
      });
      this.tables = draft;
      const appended = draft.outbox.slice(before);
      if (appended.length) this.listeners.forEach((listener) => listener(appended));
      return result;
    });
  }

  /** The projection has its own transactions, independent of command ones. */
  async runPublic<TResult>(work: (store: PublicCelebrationStore) => Promise<TResult>): Promise<TResult> {
    return this.serialised(async () => {
      const draft = copyTables(this.tables);
      const result = await work(new MemoryPublicStore(draft));
      this.tables = { ...this.tables, publicRows: draft.publicRows, processed: draft.processed };
      return result;
    });
  }

  readonly publicTransactions: PublicStoreTransaction = { run: async (work) => this.runPublic(work) };

  /** Read-only access to the projection, outside any transaction. */
  publicStore(): PublicCelebrationStore { return new MemoryPublicStore(this.tables); }

  async all(): Promise<readonly EventEnvelope[]> { return structuredClone(this.tables.outbox); }
  outboxSnapshot(): readonly EventEnvelope[] { return structuredClone(this.tables.outbox); }

  /** Runs `work` once every transaction queued before it has settled, whatever their outcome. */
  private async serialised<TResult>(work: () => Promise<TResult>): Promise<TResult> {
    const previous = this.queue;
    const run = (async (): Promise<TResult> => {
      await Promise.allSettled([previous]);
      return work();
    })();
    this.queue = run;
    return run;
  }
}
