import { DomainError } from './errors.js';
export type ApprovalMode = 'AUTO_ACCEPT' | 'RESTRICTED';
export interface CelebrationSettings { giftReservationMode: ApprovalMode; unregisteredRsvpMode: ApprovalMode; extraCompanionMode: ApprovalMode; externalGiftMode: ApprovalMode; rsvpDeadline?: string; partnerPriorityEnabled: boolean }
export const defaultSettings = (): CelebrationSettings => ({ giftReservationMode: 'RESTRICTED', unregisteredRsvpMode: 'RESTRICTED', extraCompanionMode: 'RESTRICTED', externalGiftMode: 'RESTRICTED', partnerPriorityEnabled: false });
export function updateSettings(current: CelebrationSettings, patch: Partial<CelebrationSettings>, actorRole: string, belongsToOrganization: boolean): CelebrationSettings {
  if (actorRole !== 'HOST' && !(actorRole === 'PLANNER' && belongsToOrganization)) throw new DomainError('Only a host or organization planner may update settings', 403);
  return { ...current, ...patch };
}
