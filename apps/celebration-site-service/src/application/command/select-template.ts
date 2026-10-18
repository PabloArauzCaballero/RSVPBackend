import { InvariantError } from '../../domain/errors.js';
import type { CelebrationState } from '../../domain/model/celebration.js';
import { TemplateStatus } from '../../domain/port/reference-data.js';
import { mutateCelebration, type ApplicationDeps, type MutationInput, type RequestContext } from './command-runner.js';
import { requireEventType } from './edit-celebration.js';

/**
 * Picks a template from the local copy of the Template/Media catalog. Only
 * PUBLISHED templates whose tags the event type accepts are valid; the content
 * is untouched, so switching back restores the exact same site.
 */
export async function selectTemplate(deps: ApplicationDeps, request: RequestContext, input: MutationInput & { readonly templateId: string }): Promise<CelebrationState> {
  return mutateCelebration(deps, request, input, async (celebration, tx, now) => {
    const template = await tx.templates.get(input.templateId);
    if (!template || template.status !== TemplateStatus.Published) {
      throw new InvariantError('UNKNOWN_TEMPLATE', 'Template does not exist or is not published', { field: 'templateId' });
    }
    celebration.selectTemplate(template.templateId, template.tags, await requireEventType(tx, celebration.state.eventTypeCode), now);
  });
}
