import { ForbiddenError, NotFoundError } from '../../domain/errors.js';
import { CelebrationEventType, type RecordedEvent } from '../../domain/event/celebration-events.js';
import { buildEnvelope } from '../../domain/event/envelope.js';
import type { Celebration, CelebrationState } from '../../domain/model/celebration.js';
import { AccessLevel, accessLevel, scopeOf, type Actor } from '../../domain/policy/access.js';
import type { Clock, IdGenerator, TransactionContext, UnitOfWork } from '../ports.js';

export interface ApplicationDeps {
  readonly uow: UnitOfWork;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/** Who is asking, and the correlation id that every event and log line of the request carries. */
export interface RequestContext {
  readonly actor: Actor;
  readonly correlationId: string;
}

const AUDIT_ACTIONS: Readonly<Record<CelebrationEventType, string>> = {
  [CelebrationEventType.Created]: 'CREATED',
  [CelebrationEventType.TypeAssigned]: 'TYPE_ASSIGNED',
  [CelebrationEventType.Configured]: 'CONFIGURED',
  [CelebrationEventType.SettingsUpdated]: 'SETTINGS_UPDATED',
  [CelebrationEventType.Published]: 'PUBLISHED',
  [CelebrationEventType.Unpublished]: 'UNPUBLISHED',
  [CelebrationEventType.Archived]: 'ARCHIVED',
  [CelebrationEventType.TemplateSelected]: 'TEMPLATE_SELECTED'
};

/** Audit rows keep what changed and why, never the full content (it may hold names). */
function auditDetails(event: RecordedEvent): Readonly<Record<string, unknown>> {
  return Object.fromEntries(Object.entries(event.payload).filter(([key]) => key !== 'celebration' && key !== 'eventType'));
}

/** Persists the aggregate's recorded events as outbox envelopes and audit rows, in the caller's transaction. */
export async function flushEvents(tx: TransactionContext, deps: ApplicationDeps, request: RequestContext, celebration: Celebration): Promise<void> {
  const state = celebration.state;
  await celebration.pullEvents().reduce(async (previous, event) => {
    await previous;
    const eventId = deps.ids.next();
    await tx.outbox.append(buildEnvelope({
      eventId,
      eventType: event.type,
      occurredAt: event.occurredAt,
      correlationId: request.correlationId,
      celebrationId: state.id,
      organizationId: state.organizationId,
      actorId: request.actor.userId,
      payload: event.payload
    }));
    await tx.audit.append({ id: deps.ids.next(), celebrationId: state.id, action: AUDIT_ACTIONS[event.type], actorId: request.actor.userId, at: event.occurredAt, eventId, details: auditDetails(event) });
  }, Promise.resolve());
}

/** Loads a celebration the actor may see, enforcing 404 for strangers and 403 for read-only actors. */
export async function loadAuthorized(tx: TransactionContext, actor: Actor, celebrationId: string, required: AccessLevel): Promise<Celebration> {
  const celebration = await tx.celebrations.findById(scopeOf(actor), celebrationId);
  const level = celebration ? accessLevel(celebration.facts(), actor) : AccessLevel.None;
  if (!celebration || level === AccessLevel.None) throw new NotFoundError();
  if (required === AccessLevel.Manage && level !== AccessLevel.Manage) {
    throw new ForbiddenError('Only the hosts or a planner of the organization can change this celebration');
  }
  return celebration;
}

export interface MutationInput {
  readonly celebrationId: string;
  readonly expectedVersion: number;
}

/**
 * The shape of every write: authorize, check the If-Match version, mutate,
 * persist with the optimistic predicate, and flush events — one transaction.
 */
export async function mutateCelebration(
  deps: ApplicationDeps,
  request: RequestContext,
  input: MutationInput,
  mutate: (celebration: Celebration, tx: TransactionContext, now: string) => Promise<void>
): Promise<CelebrationState> {
  return deps.uow.run(scopeOf(request.actor), async (tx) => {
    const celebration = await loadAuthorized(tx, request.actor, input.celebrationId, AccessLevel.Manage);
    celebration.assertVersion(input.expectedVersion);
    await mutate(celebration, tx, deps.clock.now());
    if (celebration.version !== celebration.loadedVersion) {
      await tx.celebrations.update(celebration);
      await flushEvents(tx, deps, request, celebration);
    }
    return celebration.state;
  });
}
