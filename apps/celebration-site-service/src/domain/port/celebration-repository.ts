import type { Celebration } from '../model/celebration.js';
import type { AccessScope } from '../policy/access.js';

export interface Page {
  readonly limit: number;
  readonly offset: number;
}

/**
 * Every read is tenant-scoped: there is no method that fetches a celebration
 * without both its id and the scope of the actor asking (lane 10 DoD).
 */
export interface CelebrationRepository {
  /** Undefined when it does not exist *or* the scope may not see it. */
  findById(scope: AccessScope, celebrationId: string): Promise<Celebration | undefined>;
  list(scope: AccessScope, page: Page): Promise<readonly Celebration[]>;
  /** Fails with SLUG_TAKEN when the slug is used by any celebration, of any tenant. */
  insert(celebration: Celebration): Promise<void>;
  /** Writes only if the stored version is still `celebration.loadedVersion`; otherwise VERSION_CONFLICT. */
  update(celebration: Celebration): Promise<void>;
}
