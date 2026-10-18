import { upsertEventType } from './command/admin-reference-data.js';
import { createCelebration } from './command/create-celebration.js';
import { assignEventType, editCelebration, setCollaborator } from './command/edit-celebration.js';
import { archiveCelebration, publishCelebration, unpublishCelebration } from './command/publish-celebration.js';
import { selectTemplate } from './command/select-template.js';
import { updateSettings } from './command/update-settings.js';
import type { ApplicationDeps, RequestContext } from './command/command-runner.js';
import { getAuditLog, getCelebration, listCelebrations, publishCheck } from './query/get-celebration.js';
import { getEventType, listEventTypes } from './query/get-event-types.js';

type Bound<TFunction> = TFunction extends (deps: ApplicationDeps, request: RequestContext, ...rest: infer TRest) => infer TResult
  ? (request: RequestContext, ...rest: TRest) => TResult
  : never;

const bind = <TFunction extends (deps: ApplicationDeps, request: RequestContext, ...rest: never[]) => unknown>(deps: ApplicationDeps, use: TFunction): Bound<TFunction> =>
  // Partial application keeps the remaining parameter list intact.
  ((request: RequestContext, ...rest: never[]) => use(deps, request, ...rest)) as Bound<TFunction>;

/** Use cases bound to one set of adapters; a convenient entry point for scripts and tests. */
export function celebrationApplication(deps: ApplicationDeps) {
  return {
    create: bind(deps, createCelebration),
    edit: bind(deps, editCelebration),
    assignType: bind(deps, assignEventType),
    setCollaborator: bind(deps, setCollaborator),
    updateSettings: bind(deps, updateSettings),
    publish: bind(deps, publishCelebration),
    unpublish: bind(deps, unpublishCelebration),
    archive: bind(deps, archiveCelebration),
    selectTemplate: bind(deps, selectTemplate),
    upsertEventType: bind(deps, upsertEventType),
    get: bind(deps, getCelebration),
    list: bind(deps, listCelebrations),
    publishCheck: bind(deps, publishCheck),
    audit: bind(deps, getAuditLog),
    eventTypes: async (acceptLanguage?: string) => listEventTypes(deps, acceptLanguage),
    eventType: async (code: string, acceptLanguage?: string) => getEventType(deps, code, acceptLanguage)
  } as const;
}

export type CelebrationApplication = ReturnType<typeof celebrationApplication>;
