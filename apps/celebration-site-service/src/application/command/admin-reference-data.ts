import { ForbiddenError } from '../../domain/errors.js';
import { defineEventType, type EventTypeDefinition } from '../../domain/model/event-type-definition.js';
import { isAdmin, scopeOf } from '../../domain/policy/access.js';
import type { TemplateReference } from '../../domain/port/reference-data.js';
import type { ApplicationDeps, RequestContext } from './command-runner.js';

/** Platform admin creates or edits an event type (F14 editor). Valid immediately, no deploy. */
export async function upsertEventType(deps: ApplicationDeps, request: RequestContext, definition: EventTypeDefinition): Promise<{ readonly created: boolean; readonly definition: EventTypeDefinition }> {
  if (!isAdmin(request.actor)) throw new ForbiddenError('Only platform administrators manage event types');
  const valid = defineEventType(definition);
  const created = await deps.uow.run(scopeOf(request.actor), async (tx) => tx.eventTypes.upsert(valid));
  return { created, definition: valid };
}

/** Applied by the Template/Media consumer; the system scope has admin visibility. */
export async function recordTemplateReference(deps: ApplicationDeps, reference: TemplateReference): Promise<void> {
  await deps.uow.run({ userId: SYSTEM_USER, organizationIds: [], admin: true }, async (tx) => tx.templates.upsert(reference));
}

export const SYSTEM_USER = '00000000-0000-0000-0000-000000000000';
