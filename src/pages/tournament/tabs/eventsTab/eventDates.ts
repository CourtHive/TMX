// Pure logic for an event's active dates and days of the week. No UI imports, so it is tested
// through the real engine. The validation mirrors the factory's setEventDates so a save the factory
// would refuse is refused here, before anything is sent.
import { SET_EVENT_DATES } from 'constants/mutationConstants';
import { weekdayConstants } from 'tods-competition-factory';

/** Factory weekday codes in calendar order, Monday first. */
export const EVENT_WEEKDAYS: string[] = Object.keys(weekdayConstants);

// index into the `i18n.weekdaysShort_N` keys, which count from Sunday
const SHORT_LABEL_INDEX: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

export function weekdayLabelKey(weekday: string): string {
  return `i18n.weekdaysShort_${SHORT_LABEL_INDEX[weekday]}`;
}

/** The factory's date-only check: YYYY-MM-DD naming a real calendar day. */
export function isCanonicalDate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Active dates from a picker value (array, or a comma-separated string): trimmed, unique, sorted. */
export function parseActiveDates(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  const dates = list.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean);
  return Array.from(new Set(dates)).sort((a, b) => a.localeCompare(b));
}

/** Weekday codes, unique, in calendar order. Unknown codes are kept (at the end) so validation sees them. */
export function normalizeWeekdays(weekdays: unknown): string[] {
  const list = Array.isArray(weekdays) ? weekdays.filter((day) => typeof day === 'string') : [];
  const known = EVENT_WEEKDAYS.filter((day) => list.includes(day));
  const unknown = list.filter((day) => !EVENT_WEEKDAYS.includes(day));
  return [...known, ...unknown];
}

export type EventDatesRefusal =
  'INVALID_DATE' | 'START_AFTER_END' | 'OUTSIDE_TOURNAMENT' | 'ACTIVE_DATE_OUTSIDE_EVENT' | 'INVALID_WEEKDAYS';

export interface EventDatesInput {
  tournamentStartDate?: string;
  tournamentEndDate?: string;
  startDate?: string;
  endDate?: string;
  activeDates?: string[];
  weekdays?: string[];
}

const dayOf = (date: string) => date.slice(0, 10);

/** What setEventDates would refuse for these values, or undefined when it would accept them. */
export function eventDatesRefusal(input: EventDatesInput): EventDatesRefusal | undefined {
  const { tournamentStartDate, tournamentEndDate, startDate, endDate } = input;
  const activeDates = (input.activeDates ?? []).filter(Boolean);
  const weekdays = input.weekdays ?? [];

  if (startDate && !isCanonicalDate(dayOf(startDate))) return 'INVALID_DATE';
  if (endDate && !isCanonicalDate(dayOf(endDate))) return 'INVALID_DATE';
  if (!activeDates.every(isCanonicalDate)) return 'INVALID_DATE';
  if (new Set(weekdays).size !== weekdays.length || weekdays.some((day) => !EVENT_WEEKDAYS.includes(day)))
    return 'INVALID_WEEKDAYS';

  if (startDate && endDate && dayOf(startDate) > dayOf(endDate)) return 'START_AFTER_END';

  const start = startDate || tournamentStartDate;
  const end = endDate || tournamentEndDate;
  if (activeDates.some((date) => (start && date < dayOf(start)) || (end && date > dayOf(end))))
    return 'ACTIVE_DATE_OUTSIDE_EVENT';

  // the event's own dates must lie within the tournament's (setEventStartDate / setEventEndDate)
  const outside = (date?: string) =>
    !!date &&
    (!tournamentStartDate ||
      !tournamentEndDate ||
      dayOf(date) < dayOf(tournamentStartDate) ||
      dayOf(date) > dayOf(tournamentEndDate));
  if (outside(startDate) || outside(endDate)) return 'OUTSIDE_TOURNAMENT';

  return undefined;
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((value, i) => value === b[i]);

export interface SetEventDatesArgs {
  eventId: string;
  startDate?: string;
  endDate?: string;
  activeDates: string[];
  weekdays: string[];
  /** The event as stored; omit for a new event. */
  previous?: { activeDates?: string[]; weekdays?: string[] };
}

/**
 * The setEventDates method for a save, or undefined when the active dates and weekdays are unchanged
 * (a new event with neither set sends nothing). Clearing sends empty lists, which the factory stores.
 */
export function buildSetEventDatesMethod(args: SetEventDatesArgs): { method: string; params: any } | undefined {
  const activeDates = parseActiveDates(args.activeDates);
  const weekdays = normalizeWeekdays(args.weekdays);
  const previousActiveDates = parseActiveDates(args.previous?.activeDates ?? []);
  const previousWeekdays = normalizeWeekdays(args.previous?.weekdays ?? []);
  if (sameList(activeDates, previousActiveDates) && sameList(weekdays, previousWeekdays)) return undefined;

  const params: any = { eventId: args.eventId, activeDates, weekdays };
  if (args.startDate) params.startDate = args.startDate;
  if (args.endDate) params.endDate = args.endDate;
  return { method: SET_EVENT_DATES, params };
}
