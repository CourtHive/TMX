/**
 * Shared rules for the three matchUp schedule time fields (scheduledTime, startTime, endTime).
 *
 * Two call sites edit these fields — the schedule table cells (`getMatchUpColumns`) and the
 * matchUp actions popover (`matchUpActions`). They had drifted: the popover validated, the table
 * cell did not, so an impossible end time reached the server from one path and not the other.
 * Both now go through here.
 */
import { tools } from 'tods-competition-factory';
import { t } from 'i18n';

export type ScheduleTimeField = 'scheduledTime' | 'startTime' | 'endTime';

export type ScheduleTimes = {
  scheduledTime?: string;
  startTime?: string;
  endTime?: string;
};

/** Court availability window for the matchUp's scheduled date, when one is known. */
export type TimeBounds = { earliest?: string; latest?: string };

const MINUTES_PER_DAY = 24 * 60;

/**
 * Mirrors factory's `MAX_CROSS_MIDNIGHT_SPAN_MS` in
 * `mutate/matchUps/schedule/scheduleItems/scheduleItems.ts`. A same-day end that sorts at or before
 * the start is read as crossing midnight only when the rolled span stays inside this bound; past it
 * the engine treats the value as a genuine end-before-start error and rejects the mutation.
 *
 * Keep this in step with the engine. Validating more strictly here would block after-midnight
 * finishes the engine accepts and records via `END_DATE`; validating more loosely would hand the
 * user a silent server rejection, which is the defect this module exists to close.
 */
const MAX_CROSS_MIDNIGHT_SPAN_MINUTES = 12 * 60;

/** `timeStringMinutes` answers 0 for '', null and 'banana' alike, so screen the value first. */
function toMinutes(value?: string): number | undefined {
  if (!value || !tools.dateTime.isTimeString(value)) return undefined;
  return tools.dateTime.timeStringMinutes(value);
}

/**
 * True when the end sorts at or before the start — i.e. the match ran past midnight. Equal times
 * count as a wrap (a zero-length match is not a same-day interval), which is also how the engine
 * reads them.
 */
export function crossesMidnight({ startTime, endTime }: { startTime?: string; endTime?: string }): boolean {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === undefined || end === undefined) return false;
  return end <= start;
}

/**
 * True when `endTime` can follow `startTime` — either later the same day, or across midnight within
 * the engine's sanity cap. Absent or unparseable values are treated as acceptable: there is nothing
 * to contradict.
 */
export function endFollowsStart({ startTime, endTime }: { startTime?: string; endTime?: string }): boolean {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === undefined || end === undefined) return true;
  if (end > start) return true;
  return end - start + MINUTES_PER_DAY <= MAX_CROSS_MIDNIGHT_SPAN_MINUTES;
}

/**
 * The value the picker should open on. TMX's picker is a 12-hour clock with an AM/PM toggle, and an
 * empty seed opens it at 12:00 AM — so dialing an afternoon time without touching the toggle sends
 * a small-hours value. Seeding from a time the operator already set puts the toggle on the right
 * side of noon before they touch it.
 */
export function resolveTimeSeed({
  field,
  schedule = {},
  bounds = {},
}: {
  field: ScheduleTimeField;
  schedule?: ScheduleTimes;
  bounds?: TimeBounds;
}): string {
  const existing = schedule[field];
  if (existing) return existing;
  if (field === 'endTime') return schedule.startTime || schedule.scheduledTime || bounds.latest || '';
  if (field === 'startTime') return schedule.scheduledTime || bounds.earliest || '';
  return bounds.earliest || '';
}

function boundsError(value: string, { earliest, latest }: TimeBounds): string | undefined {
  if (earliest && value < earliest) return t('toasts.schedule.beforeCourtOpens', { time: value, earliest });
  if (latest && value > latest) return t('toasts.schedule.afterCourtCloses', { time: value, latest });
  return undefined;
}

/**
 * Returns a human-readable reason the value cannot be used, or `undefined` when it is acceptable.
 *
 * Values are military `HH:MM` — callers convert through `tools.dateTime.convertTime(time, true)`
 * before validating, so string comparison against the availability window is safe.
 */
export function validateTimeValue({
  field,
  value,
  schedule = {},
  bounds = {},
}: {
  field: ScheduleTimeField;
  value: string;
  schedule?: ScheduleTimes;
  bounds?: TimeBounds;
}): string | undefined {
  if (!value) return undefined;

  // A court's availability window describes one calendar day, so it cannot speak to an end time
  // that lands after midnight. Applying it there would reject a legitimate late finish.
  const wraps = field === 'endTime' && crossesMidnight({ startTime: schedule.startTime, endTime: value });
  if (!wraps) {
    const outOfBounds = boundsError(value, bounds);
    if (outOfBounds) return outOfBounds;
  }

  if (field === 'endTime' && !endFollowsStart({ startTime: schedule.startTime, endTime: value })) {
    return t('toasts.schedule.endBeforeStart', { endTime: value, startTime: schedule.startTime });
  }

  if (field === 'startTime' && !endFollowsStart({ startTime: value, endTime: schedule.endTime })) {
    return t('toasts.schedule.startAfterEnd', { startTime: value, endTime: schedule.endTime });
  }

  return undefined;
}
