/**
 * Tenancy (lane 10). A celebration is the tenant. Who may touch it:
 * - its owner and its CO_HOST collaborators manage it;
 * - planners of the owning organization manage it, other members of that organization read it;
 * - VIEWER collaborators read it;
 * - platform ADMINs manage every celebration;
 * - anybody else does not know it exists (404, never 403).
 */

export const PlatformRole = { Admin: 'ADMIN', Planner: 'PLANNER', Host: 'HOST', Provider: 'PROVIDER' } as const;
export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];

export const CollaboratorRole = { CoHost: 'CO_HOST', Viewer: 'VIEWER' } as const;
export type CollaboratorRole = (typeof CollaboratorRole)[keyof typeof CollaboratorRole];

export const AccessLevel = { None: 'NONE', Read: 'READ', Manage: 'MANAGE' } as const;
export type AccessLevel = (typeof AccessLevel)[keyof typeof AccessLevel];

export interface Actor {
  readonly userId: string;
  readonly roles: readonly string[];
  readonly organizationIds: readonly string[];
}

export interface Collaborator {
  readonly userId: string;
  readonly role: CollaboratorRole;
}

export interface TenantFacts {
  readonly ownerId: string;
  readonly organizationId: string | null;
  readonly collaborators: readonly Collaborator[];
}

const collaboratorLevel: Readonly<Record<CollaboratorRole, AccessLevel>> = {
  [CollaboratorRole.CoHost]: AccessLevel.Manage,
  [CollaboratorRole.Viewer]: AccessLevel.Read
};

/** Ascending privilege; the position in this list is the rank. */
const LEVELS_BY_PRIVILEGE: readonly AccessLevel[] = [AccessLevel.None, AccessLevel.Read, AccessLevel.Manage];
const rankOf = (level: AccessLevel): number => LEVELS_BY_PRIVILEGE.indexOf(level);

export function isAdmin(actor: Actor): boolean { return actor.roles.includes(PlatformRole.Admin); }

function organizationLevel(facts: TenantFacts, actor: Actor): AccessLevel {
  if (facts.organizationId === null || !actor.organizationIds.includes(facts.organizationId)) return AccessLevel.None;
  return actor.roles.includes(PlatformRole.Planner) ? AccessLevel.Manage : AccessLevel.Read;
}

export function accessLevel(facts: TenantFacts, actor: Actor): AccessLevel {
  const candidates: readonly AccessLevel[] = [
    isAdmin(actor) || facts.ownerId === actor.userId ? AccessLevel.Manage : AccessLevel.None,
    organizationLevel(facts, actor),
    ...facts.collaborators.filter((collaborator) => collaborator.userId === actor.userId).map((collaborator) => collaboratorLevel[collaborator.role])
  ];
  return candidates.reduce((best, level) => (rankOf(level) > rankOf(best) ? level : best), AccessLevel.None);
}

/** The query predicate repositories must apply: the same facts the database RLS policy checks. */
export interface AccessScope {
  readonly userId: string;
  readonly organizationIds: readonly string[];
  readonly admin: boolean;
}

export function scopeOf(actor: Actor): AccessScope {
  return { userId: actor.userId, organizationIds: [...actor.organizationIds], admin: isAdmin(actor) };
}
