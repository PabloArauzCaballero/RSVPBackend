import { InvariantError } from '../../domain/errors.js';
import type { CelebrationPatch, CelebrationState } from '../../domain/model/celebration.js';
import type { CollaboratorRole } from '../../domain/policy/access.js';
import type { TransactionContext } from '../ports.js';
import { mutateCelebration, type ApplicationDeps, type MutationInput, type RequestContext } from './command-runner.js';
import type { EventTypeDefinition } from '../../domain/model/event-type-definition.js';

export async function requireEventType(tx: TransactionContext, code: string): Promise<EventTypeDefinition> {
  const type = await tx.eventTypes.get(code);
  if (!type) throw new InvariantError('UNKNOWN_EVENT_TYPE', `Event type ${code} does not exist`, { field: 'eventTypeCode' });
  return type;
}

export async function editCelebration(deps: ApplicationDeps, request: RequestContext, input: MutationInput & { readonly patch: CelebrationPatch }): Promise<CelebrationState> {
  return mutateCelebration(deps, request, input, async (celebration, tx, now) => {
    celebration.edit(input.patch, await requireEventType(tx, celebration.state.eventTypeCode), now);
  });
}

export async function assignEventType(deps: ApplicationDeps, request: RequestContext, input: MutationInput & { readonly eventTypeCode: string }): Promise<CelebrationState> {
  return mutateCelebration(deps, request, input, async (celebration, tx, now) => {
    celebration.assignType(await requireEventType(tx, input.eventTypeCode), now);
  });
}

export async function setCollaborator(deps: ApplicationDeps, request: RequestContext, input: MutationInput & { readonly userId: string; readonly role: CollaboratorRole | null }): Promise<CelebrationState> {
  return mutateCelebration(deps, request, input, async (celebration, _tx, now) => {
    celebration.setCollaborator(input.userId, input.role, now);
  });
}
