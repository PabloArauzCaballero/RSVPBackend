import type { CelebrationState } from '../../domain/model/celebration.js';
import { mutateCelebration, type ApplicationDeps, type MutationInput, type RequestContext } from './command-runner.js';
import { requireEventType } from './edit-celebration.js';

/** Lane 13: DRAFT → PUBLISHED only when the type's required fields are present; otherwise 422 listing them. */
export async function publishCelebration(deps: ApplicationDeps, request: RequestContext, input: MutationInput): Promise<CelebrationState> {
  return mutateCelebration(deps, request, input, async (celebration, tx, now) => {
    celebration.publish(await requireEventType(tx, celebration.state.eventTypeCode), now);
  });
}

/** PUBLISHED → DRAFT; who and when are kept in the audit log. */
export async function unpublishCelebration(deps: ApplicationDeps, request: RequestContext, input: MutationInput & { readonly reason?: string | null }): Promise<CelebrationState> {
  return mutateCelebration(deps, request, input, async (celebration, _tx, now) => {
    celebration.unpublish(input.reason ?? null, now);
  });
}

/** ARCHIVED is terminal. */
export async function archiveCelebration(deps: ApplicationDeps, request: RequestContext, input: MutationInput): Promise<CelebrationState> {
  return mutateCelebration(deps, request, input, async (celebration, _tx, now) => {
    celebration.archive(now);
  });
}
