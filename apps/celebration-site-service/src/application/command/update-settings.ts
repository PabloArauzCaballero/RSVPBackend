import type { CelebrationState } from '../../domain/model/celebration.js';
import type { SettingsPatch } from '../../domain/model/celebration-settings.js';
import { mutateCelebration, type ApplicationDeps, type MutationInput, type RequestContext } from './command-runner.js';

/**
 * Lane 12. Only hosts and planners of the organization reach the mutation
 * (403 otherwise). Requests already waiting keep their state: the event says
 * from when the new value applies, and consumers never re-evaluate the past.
 */
export async function updateSettings(deps: ApplicationDeps, request: RequestContext, input: MutationInput & { readonly patch: SettingsPatch }): Promise<CelebrationState> {
  return mutateCelebration(deps, request, input, async (celebration, _tx, now) => {
    celebration.changeSettings(input.patch, now);
  });
}
