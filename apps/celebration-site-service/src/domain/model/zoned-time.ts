import { InvariantError } from '../errors.js';

/**
 * Time rules (lane 14): instants are stored in UTC; wall-clock values are always
 * interpreted and rendered in the celebration's IANA time zone, never in the
 * zone of the server or of the person asking.
 */

export interface LocalDateTime {
  readonly date: string;      // YYYY-MM-DD in the celebration zone
  readonly time: string;      // HH:mm in the celebration zone
  readonly timeZone: string;  // IANA zone
  readonly utcOffset: string; // e.g. -04:00, valid for that instant
}

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MS_PER_DAY = 86_400_000;
const TWO_DIGITS = 2;

// Wall-clock date-time without offset. Matches "2026-12-19T23:30" → (2026, 12, 19, 23, 30); rejects "2026-12-19T23:30Z".
// https://regex101.com/?flavor=javascript&regex=%5E(%5Cd%7B4%7D)-(%5Cd%7B2%7D)-(%5Cd%7B2%7D)T(%5Cd%7B2%7D)%3A(%5Cd%7B2%7D)(%3F%3A%3A(%5Cd%7B2%7D))%3F%24&flags=gm&testString=2026-12-19T23%3A30%0A2026-12-19T23%3A30Z
const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

// ISO-8601 instant with explicit offset. Matches "2026-12-19T23:30:00-04:00"; rejects "2026-12-19T23:30".
// https://regex101.com/?flavor=javascript&regex=%5E%5Cd%7B4%7D-%5Cd%7B2%7D-%5Cd%7B2%7DT%5Cd%7B2%7D%3A%5Cd%7B2%7D(%3F%3A%3A%5Cd%7B2%7D(%3F%3A%5C.%5Cd%7B1%2C9%7D)%3F)%3F(%3F%3AZ%7C%5B%2B-%5D%5Cd%7B2%7D%3A%5Cd%7B2%7D)%24&flags=gm&testString=2026-12-19T23%3A30%3A00-04%3A00%0A2026-12-19T23%3A30
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

const UTC_ZONE = 'UTC';
const REGION_SEPARATOR = '/';

export function assertTimeZone(timeZone: string): string {
  const fail = (): never => { throw new InvariantError('INVALID_TIME_ZONE', `"${timeZone}" is not an IANA time zone`, { field: 'timeZone' }); };
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0);
  } catch {
    return fail();
  }
  // Bare abbreviations like "EST" are accepted by Intl but are not a place where an event happens.
  if (!timeZone.includes(REGION_SEPARATOR) && timeZone !== UTC_ZONE) return fail();
  return timeZone;
}

type WallParts = Readonly<Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>>;

function partsIn(epochMs: number, timeZone: string): WallParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const entries = formatter.formatToParts(epochMs).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)] as const);
  // formatToParts with these options always yields exactly the six numeric fields of WallParts.
  return Object.fromEntries(entries) as WallParts;
}

/** Offset of `timeZone` from UTC at a given instant, in minutes (La Paz is -240). */
export function offsetMinutesAt(epochMs: number, timeZone: string): number {
  const p = partsIn(epochMs, timeZone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(epochMs / MS_PER_SECOND) * MS_PER_SECOND;
  return Math.round((wallAsUtc - truncated) / MS_PER_MINUTE);
}

const pad = (value: number): string => String(value).padStart(TWO_DIGITS, '0');

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);
  return `${sign}${pad(Math.floor(absolute / MINUTES_PER_HOUR))}:${pad(absolute % MINUTES_PER_HOUR)}`;
}

export function isInstant(value: unknown): value is string {
  return typeof value === 'string' && INSTANT_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

/** Normalises any instant with an explicit offset to `...Z`. */
export function toUtcInstant(value: string): string {
  if (!isInstant(value)) throw new InvariantError('INVALID_INSTANT', `"${value}" is not an ISO-8601 instant with offset`);
  return new Date(value).toISOString();
}

/**
 * Converts a wall-clock time in `timeZone` to a UTC instant.
 * - Gap (clocks jump forward, the local time does not exist): moves forward by the
 *   size of the gap, which is what a person means by "02:30" on that night.
 * - Overlap (clocks go back, the local time happens twice): takes the first occurrence.
 */
export function localToUtc(local: string, timeZone: string): string {
  const match = LOCAL_PATTERN.exec(local);
  if (!match) throw new InvariantError('INVALID_LOCAL_DATE_TIME', `"${local}" must be YYYY-MM-DDTHH:mm`);
  const [year, month, day, hour, minute, second] = match.slice(1).map((group) => Number(group ?? 0)) as [number, number, number, number, number, number];
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(wallAsUtc) || new Date(wallAsUtc).getUTCDate() !== day) {
    throw new InvariantError('INVALID_LOCAL_DATE_TIME', `"${local}" is not a calendar date`);
  }
  const before = offsetMinutesAt(wallAsUtc - MS_PER_DAY, timeZone);
  const after = offsetMinutesAt(wallAsUtc + MS_PER_DAY, timeZone);
  const valid = [...new Set([before, after, offsetMinutesAt(wallAsUtc, timeZone)])]
    .map((offset) => wallAsUtc - offset * MS_PER_MINUTE)
    .filter((instant) => offsetMinutesAt(instant, timeZone) * MS_PER_MINUTE === wallAsUtc - instant)
    .sort((a, b) => a - b);
  const chosen = valid[0] ?? wallAsUtc - before * MS_PER_MINUTE;
  return new Date(chosen).toISOString();
}

/** Renders a UTC instant as the wall clock of the celebration, whatever the server zone is. */
export function toLocal(instant: string, timeZone: string): LocalDateTime {
  const epochMs = Date.parse(instant);
  if (!Number.isFinite(epochMs)) throw new InvariantError('INVALID_INSTANT', `"${instant}" is not an instant`);
  const p = partsIn(epochMs, timeZone);
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
    timeZone,
    utcOffset: formatOffset(offsetMinutesAt(epochMs, timeZone))
  };
}

/** Instants keep their meaning; wall-clock values are read in the celebration zone. */
export function normaliseTemporal(value: string, timeZone: string): string {
  return isInstant(value) ? toUtcInstant(value) : localToUtc(value, timeZone);
}

const EVENT_DATE_KEY = 'eventDate';
const INSTANT_KEY_SUFFIX = 'At';
const PATH_SEPARATOR = '.';

/** Content convention: `eventDate` and every key ending in `At` hold instants. */
export const isTemporalKey = (key: string): boolean => key === EVENT_DATE_KEY || key.endsWith(INSTANT_KEY_SUFFIX);

/**
 * Every instant inside `value`, keyed by its dot path (`schedule.0.startsAt`),
 * rendered as the wall clock of `timeZone`. Clients show these and never do
 * time-zone math of their own.
 */
export function localTimesOf(value: unknown, timeZone: string, path = ''): Record<string, LocalDateTime> {
  if (value === null || typeof value !== 'object') return {};
  const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value);
  return Object.fromEntries(entries.flatMap(([key, nested]) => {
    const nestedPath = path ? `${path}${PATH_SEPARATOR}${key}` : key;
    if (isTemporalKey(key) && isInstant(nested)) return [[nestedPath, toLocal(nested, timeZone)]];
    return Object.entries(localTimesOf(nested, timeZone, nestedPath));
  }));
}
