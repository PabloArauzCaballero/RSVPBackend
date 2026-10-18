import { InvariantError } from '../errors.js';
import { isInstant, normaliseTemporal, toUtcInstant } from './zoned-time.js';

const UTC = 'UTC';

// Wall-clock date-time. Matches "2026-12-10T23:59"; rejects "tomorrow".
// https://regex101.com/?flavor=javascript&regex=%5E%5Cd%7B4%7D-%5Cd%7B2%7D-%5Cd%7B2%7DT%5Cd%7B2%7D%3A%5Cd%7B2%7D%24&flags=gm&testString=2026-12-10T23%3A59%0Atomorrow
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * The four approval switches (lane 12). Each one decides whether a kind of guest
 * request is approved on its own or waits in the host's inbox. Changes are
 * never retroactive: `effectiveFrom` tells consumers which requests the new
 * value applies to, and requests created before it keep their state.
 */

export const ApprovalMode = { AutoAccept: 'AUTO_ACCEPT', Restricted: 'RESTRICTED' } as const;
export type ApprovalMode = (typeof ApprovalMode)[keyof typeof ApprovalMode];

export const APPROVAL_SWITCHES = ['giftReservationMode', 'unregisteredRsvpMode', 'extraCompanionMode', 'externalGiftMode'] as const;
export type ApprovalSwitch = (typeof APPROVAL_SWITCHES)[number];

export type CelebrationSettings = Readonly<Record<ApprovalSwitch, ApprovalMode>> & {
  readonly rsvpDeadline: string | null;
  readonly partnerPriorityEnabled: boolean;
  /** Increments on every change so consumers can ignore stale deliveries. */
  readonly settingsVersion: number;
  /** Instant from which the current values apply. */
  readonly effectiveFrom: string;
};

export type SettingsPatch = Partial<Record<ApprovalSwitch, ApprovalMode>> & {
  readonly rsvpDeadline?: string | null;
  readonly partnerPriorityEnabled?: boolean;
};

const modes: readonly string[] = Object.values(ApprovalMode);

function normaliseDeadline(deadline: string, timeZone: string | undefined): string {
  return isInstant(deadline) ? toUtcInstant(deadline) : normaliseTemporal(deadline, timeZone ?? UTC);
}
const FIRST_SETTINGS_VERSION = 1;

/** Safe default (REQ-12-06): every switch starts RESTRICTED, so nothing is approved behind the host's back. */
export function defaultSettings(now: string): CelebrationSettings {
  return {
    giftReservationMode: ApprovalMode.Restricted,
    unregisteredRsvpMode: ApprovalMode.Restricted,
    extraCompanionMode: ApprovalMode.Restricted,
    externalGiftMode: ApprovalMode.Restricted,
    rsvpDeadline: null,
    partnerPriorityEnabled: false,
    settingsVersion: FIRST_SETTINGS_VERSION,
    effectiveFrom: now
  };
}

export interface SettingsChange {
  readonly settings: CelebrationSettings;
  readonly changedFields: readonly string[];
}

/**
 * Applies a patch; returns no change when every value is already the requested one.
 * `rsvpDeadline` may be an instant with offset or a wall clock (YYYY-MM-DDTHH:mm) read in
 * `timeZone`, the celebration's zone, so clients never do time-zone arithmetic.
 */
export function applySettingsPatch(current: CelebrationSettings, patch: SettingsPatch, now: string, timeZone?: string): SettingsChange {
  const switchUpdates = APPROVAL_SWITCHES.filter((key) => patch[key] !== undefined).map((key) => {
    const mode = patch[key];
    if (!mode || !modes.includes(mode)) throw new InvariantError('INVALID_APPROVAL_MODE', `${key} must be one of ${modes.join(', ')}`, { field: key });
    return [key, mode] as const;
  });
  const deadline = patch.rsvpDeadline;
  const readable = deadline === undefined || deadline === null || isInstant(deadline) || (timeZone !== undefined && LOCAL_DATE_TIME.test(deadline));
  if (!readable) {
    throw new InvariantError('INVALID_RSVP_DEADLINE', 'rsvpDeadline must be an ISO-8601 instant with offset or YYYY-MM-DDTHH:mm in the celebration time zone', { field: 'rsvpDeadline' });
  }
  const normalised = deadline === undefined || deadline === null ? deadline : normaliseDeadline(deadline, timeZone);
  const candidate: CelebrationSettings = {
    ...current,
    ...Object.fromEntries(switchUpdates),
    ...(normalised === undefined ? {} : { rsvpDeadline: normalised }),
    ...(patch.partnerPriorityEnabled === undefined ? {} : { partnerPriorityEnabled: patch.partnerPriorityEnabled })
  };
  const compared = [...APPROVAL_SWITCHES, 'rsvpDeadline', 'partnerPriorityEnabled'] as const;
  const changedFields = compared.filter((key) => candidate[key] !== current[key]);
  if (!changedFields.length) return { settings: current, changedFields };
  return { settings: { ...candidate, settingsVersion: current.settingsVersion + 1, effectiveFrom: now }, changedFields };
}

/** True when the deadline has passed: Guest/RSVP freezes answers from that instant. */
export function rsvpWindowClosed(settings: CelebrationSettings, now: string): boolean {
  return settings.rsvpDeadline !== null && Date.parse(now) > Date.parse(settings.rsvpDeadline);
}
