import { AccessLevel, accessLevel, scopeOf } from '../../domain/policy/access.js';
import type { CelebrationState } from '../../domain/model/celebration.js';
import { localTimesOf, type LocalDateTime } from '../../domain/model/zoned-time.js';
import type { Page } from '../../domain/port/celebration-repository.js';
import { loadAuthorized, type ApplicationDeps, type RequestContext } from '../command/command-runner.js';
import { requireEventType } from '../command/edit-celebration.js';
import type { AuditEntry } from '../ports.js';

export interface CelebrationView extends CelebrationState {
  /** What the asking actor may do, so clients can hide what they cannot use. */
  readonly access: AccessLevel;
  /** Every instant in content, as the wall clock of the celebration. */
  readonly localTimes: Readonly<Record<string, LocalDateTime>>;
}

function viewOf(state: CelebrationState, access: AccessLevel): CelebrationView {
  return { ...state, access, localTimes: localTimesOf({ ...state.content, rsvpDeadline: state.settings.rsvpDeadline }, state.timeZone) };
}

export async function getCelebration(deps: ApplicationDeps, request: RequestContext, celebrationId: string): Promise<CelebrationView> {
  return deps.uow.run(scopeOf(request.actor), async (tx) => {
    const celebration = await loadAuthorized(tx, request.actor, celebrationId, AccessLevel.Read);
    return viewOf(celebration.state, accessLevel(celebration.facts(), request.actor));
  });
}

export async function listCelebrations(deps: ApplicationDeps, request: RequestContext, page: Page): Promise<readonly CelebrationView[]> {
  return deps.uow.run(scopeOf(request.actor), async (tx) => {
    const found = await tx.celebrations.list(scopeOf(request.actor), page);
    return found
      .map((celebration) => viewOf(celebration.state, accessLevel(celebration.facts(), request.actor)))
      .filter((view) => view.access !== AccessLevel.None);
  });
}

export interface PublishCheck {
  readonly ready: boolean;
  readonly missingFields: readonly string[];
  readonly status: CelebrationState['status'];
  readonly version: number;
}

/** The F12 checklist: same rule as the publish command, without the transition. */
export async function publishCheck(deps: ApplicationDeps, request: RequestContext, celebrationId: string): Promise<PublishCheck> {
  return deps.uow.run(scopeOf(request.actor), async (tx) => {
    const celebration = await loadAuthorized(tx, request.actor, celebrationId, AccessLevel.Read);
    const missingFields = celebration.publishReadiness(await requireEventType(tx, celebration.state.eventTypeCode));
    return { ready: !missingFields.length, missingFields, status: celebration.status, version: celebration.version };
  });
}

export async function getAuditLog(deps: ApplicationDeps, request: RequestContext, celebrationId: string): Promise<readonly AuditEntry[]> {
  return deps.uow.run(scopeOf(request.actor), async (tx) => {
    await loadAuthorized(tx, request.actor, celebrationId, AccessLevel.Manage);
    return tx.audit.list(celebrationId);
  });
}
