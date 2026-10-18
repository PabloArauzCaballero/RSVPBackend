import { InvariantError } from '../../domain/errors.js';
import { Celebration, type CelebrationState, type NewCelebration } from '../../domain/model/celebration.js';
import { PlatformRole, scopeOf } from '../../domain/policy/access.js';
import { ForbiddenError } from '../../domain/errors.js';
import { flushEvents, type ApplicationDeps, type RequestContext } from './command-runner.js';

export type CreateCelebrationInput = Omit<NewCelebration, 'id' | 'ownerId'> & { readonly eventTypeCode: string };

export async function createCelebration(deps: ApplicationDeps, request: RequestContext, input: CreateCelebrationInput): Promise<CelebrationState> {
  const { actor } = request;
  if (input.organizationId && !actor.organizationIds.includes(input.organizationId) && !actor.roles.includes(PlatformRole.Admin)) {
    throw new ForbiddenError('You can only create celebrations for an organization you belong to');
  }
  return deps.uow.run(scopeOf(actor), async (tx) => {
    const type = await tx.eventTypes.get(input.eventTypeCode);
    if (!type) throw new InvariantError('UNKNOWN_EVENT_TYPE', `Event type ${input.eventTypeCode} does not exist`, { field: 'eventTypeCode' });
    const celebration = Celebration.create({ ...input, id: deps.ids.next(), ownerId: actor.userId }, type, deps.clock.now());
    await tx.celebrations.insert(celebration);
    await flushEvents(tx, deps, request, celebration);
    return celebration.state;
  });
}
