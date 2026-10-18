import { NotFoundError } from '../../domain/errors.js';
import { EventTypeStatus, translateEventType, type EventTypeDefinition, type TranslatedEventType } from '../../domain/model/event-type-definition.js';
import { isAdmin, scopeOf } from '../../domain/policy/access.js';
import type { ApplicationDeps, RequestContext } from '../command/command-runner.js';
import { SYSTEM_USER } from '../command/admin-reference-data.js';

const PUBLIC_SCOPE = { userId: SYSTEM_USER, organizationIds: [], admin: false } as const;

/** Types offered in onboarding, translated to the visitor's language with fallback. */
export async function listEventTypes(deps: ApplicationDeps, acceptLanguage: string | undefined): Promise<readonly TranslatedEventType[]> {
  return deps.uow.run(PUBLIC_SCOPE, async (tx) => {
    const types = await tx.eventTypes.list();
    return types.filter((type) => type.status === EventTypeStatus.Active).map((type) => translateEventType(type, acceptLanguage));
  });
}

export async function getEventType(deps: ApplicationDeps, code: string, acceptLanguage: string | undefined): Promise<TranslatedEventType> {
  return deps.uow.run(PUBLIC_SCOPE, async (tx) => {
    const type = await tx.eventTypes.get(code);
    if (!type || type.status !== EventTypeStatus.Active) throw new NotFoundError('Event type');
    return translateEventType(type, acceptLanguage);
  });
}

/** Raw definitions, retired ones included, for the admin editor. */
export async function listEventTypeDefinitions(deps: ApplicationDeps, request: RequestContext): Promise<readonly EventTypeDefinition[]> {
  if (!isAdmin(request.actor)) throw new NotFoundError('Event type');
  return deps.uow.run(scopeOf(request.actor), async (tx) => tx.eventTypes.list());
}
