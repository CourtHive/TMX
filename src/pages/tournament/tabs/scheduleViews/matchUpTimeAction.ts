/**
 * Schedule2 — setting a matchUp's scheduled time, from wherever the question came up.
 *
 * The court grid's cell popover has always offered this, and the picker it opens
 * is seeded from the court column it was clicked in: the last time already placed
 * above, rounded to the next hour. That default is *good*, and it is also purely
 * a property of the grid — there is no column above an Inspector.
 *
 * So the picker default is the caller's to supply, and the mutation is shared.
 * The alternative — a second `timePicker` call site writing its own schedule
 * method — is the shape of every divergence this codebase has had to unpick
 * later, where two surfaces edit the same field and only one remembers to carry
 * the date.
 *
 * ── The date is not optional ──
 *
 * A time with no date is not a placement. The grid only ever edits matchUps that
 * already have a `scheduledDate`, so it never had to think about this; the
 * Inspector routinely looks at an unscheduled matchUp, where writing a bare
 * `scheduledTime` would produce a matchUp that is scheduled for 14:30 on no day
 * at all — invisible on every date, and reachable only by clearing it. Callers
 * pass the day the operator is looking at, and it is written whenever the matchUp
 * does not already carry one.
 */

import { executeScheduleMethods, scheduleMutationAvailable } from './scheduleMutationControl';
import { BULK_SCHEDULE_MATCHUPS } from 'constants/mutationConstants';
import { timePicker } from 'components/modals/timePicker';
import { tools } from 'tods-competition-factory';

export interface ScheduledTimeRequest {
  matchUpId: string;
  /** Seeds the picker. `HH:MM` or a 12-hour string; `timePicker` normalises both. */
  defaultTime?: string;
  /** The matchUp's own scheduledDate, when it has one. */
  scheduledDate?: string;
  /** The day the operator is looking at — written when the matchUp has no date of its own. */
  viewedDate?: string | null;
}

/** The schedule payload for a chosen time. Exported for its own test; it is the part that gets forgotten. */
export function scheduleForTime(time: string, request: ScheduledTimeRequest): Record<string, string> | undefined {
  const scheduledTime = (tools.dateTime.convertTime(time, true) as string) || '';
  if (!scheduledTime) return undefined;

  // Only when the matchUp has none: overwriting a matchUp's own date with the
  // viewed one would silently move it off the day it was scheduled for, which is
  // a different edit from the one the operator asked for.
  const date = request.scheduledDate ? undefined : (request.viewedDate ?? undefined);
  return date ? { scheduledTime, scheduledDate: date } : { scheduledTime };
}

function dispatchSchedule(matchUpId: string, schedule: Record<string, string>): boolean {
  return executeScheduleMethods([
    { method: BULK_SCHEDULE_MATCHUPS, params: { matchUpIds: [matchUpId], schedule, removePriorValues: true } },
  ]);
}

/**
 * Open the time picker for one matchUp and write what the operator chooses.
 *
 * Returns false without opening anything when no schedule view is mounted to
 * dispatch through — see `scheduleMutationControl`.
 */
export function pickScheduledTime(request: ScheduledTimeRequest): boolean {
  // Checked rather than dispatched-and-tested: handing the executor an empty
  // batch would put plan mode through a scenario write for no methods.
  if (!scheduleMutationAvailable()) return false;
  timePicker({
    time: request.defaultTime,
    callback: ({ time }) => {
      const schedule = scheduleForTime(time, request);
      if (schedule) dispatchSchedule(request.matchUpId, schedule);
    },
  });
  return true;
}

/**
 * Drop the scheduled time and any time modifiers.
 *
 * Both together because they are one statement to the operator — "nothing is
 * claimed about when this is played" — and leaving a "not before" annotation
 * standing beside a cleared time is a claim about a time that no longer exists.
 * Mirrors the cell popover's Clear pill.
 */
export function clearScheduledTime(matchUpId: string): boolean {
  return executeScheduleMethods([
    {
      method: BULK_SCHEDULE_MATCHUPS,
      params: { matchUpIds: [matchUpId], schedule: { scheduledTime: '', timeModifiers: [] }, removePriorValues: true },
    },
  ]);
}
