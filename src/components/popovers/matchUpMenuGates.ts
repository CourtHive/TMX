import { matchUpActionConstants } from 'tods-competition-factory';
import { hasFinalResult } from 'functions/hasFinalResult';

const { SCHEDULE_DATE, SCHEDULE_TIME, CLEAR_SCHEDULE, SCHEDULE_LOCK, SCOREKEEPER, CHECK_IN, REFEREE, START, END } =
  matchUpActionConstants;

const UNPLAYED_STATUSES = new Set([
  'BYE',
  'WALKOVER',
  'DOUBLE_WALKOVER',
  'CANCELLED',
  'ABANDONED',
  'DOUBLE_DEFAULT',
  'DEFAULTED',
  'DEAD_RUBBER',
]);

/** a wall-clock time on a date; `inclusive` when the time itself is allowed (factory `ScheduleBound`) */
export type ScheduleBound = { date: string; time: string; inclusive: boolean };

export type ScheduleBounds = {
  earliestDate?: string;
  latestDate?: string;
  scheduledAfter?: ScheduleBound;
  scheduledBefore?: ScheduleBound;
  recordedAfter?: ScheduleBound;
  recordedBefore?: ScheduleBound;
};

export type MenuAction = {
  type: string;
  method?: string;
  payload?: any;
  bounds?: ScheduleBounds;
  scheduleLocked?: boolean;
};

export type MatchUpMenuGates = {
  scheduleDate?: MenuAction;
  scheduleTime?: MenuAction;
  clearSchedule?: MenuAction;
  scheduleLock?: MenuAction;
  scorekeeper?: MenuAction;
  checkIn?: MenuAction;
  referee?: MenuAction;
  start?: MenuAction;
  end?: MenuAction;
  /** the match card is TMX's own: printed for a match still to be played (CA, 2026-10-30) */
  hidePrint: boolean;
};

/**
 * Which of the matchUp popover's items a matchUp is offered. The factory decides (`matchUpActions`, CA 2026-10-30):
 * an item is offered exactly when its action is, so a finished match is not offered check-in or a scorekeeper, a
 * walkover no start or end, and a BYE or produced exit nothing. Only the match card, which the factory knows nothing
 * of, is decided here.
 */
export function matchUpMenuGates({
  matchUp,
  validActions = [],
}: {
  matchUp: any;
  validActions?: MenuAction[];
}): MatchUpMenuGates {
  const action = (type: string) => validActions.find((candidate) => candidate?.type === type);
  return {
    scheduleDate: action(SCHEDULE_DATE),
    scheduleTime: action(SCHEDULE_TIME),
    clearSchedule: action(CLEAR_SCHEDULE),
    scheduleLock: action(SCHEDULE_LOCK),
    scorekeeper: action(SCOREKEEPER),
    checkIn: action(CHECK_IN),
    referee: action(REFEREE),
    start: action(START),
    end: action(END),
    hidePrint: !matchUp || hasFinalResult(matchUp) || UNPLAYED_STATUSES.has(matchUp.matchUpStatus),
  };
}

/** The tournament's dates the date action allows: none before `earliestDate`, none after `latestDate`. */
export function datesWithinBounds(dates: string[], bounds?: ScheduleBounds): string[] {
  return dates.filter(
    (date) =>
      !(bounds?.earliestDate && date < bounds.earliestDate) && !(bounds?.latestDate && date > bounds.latestDate),
  );
}

export type BoundViolation = {
  key: 'toasts.schedule.timeBeforeBound' | 'toasts.schedule.timeAfterBound';
  bound: ScheduleBound;
};

/**
 * Whether a time on `date` falls outside the action's bounds, so the popover can say why before writing. A bound
 * applies only on its own date; the factory still judges every write, this only spares a round trip.
 */
export function timeOutsideBounds({
  bounds,
  date,
  time,
  recorded,
}: {
  bounds?: ScheduleBounds;
  date?: string;
  time: string;
  /** a start or end: judged by the recorded times of linked matchUps rather than their scheduled times */
  recorded?: boolean;
}): BoundViolation | undefined {
  if (!bounds || !date || !time) return undefined;
  const after = recorded ? bounds.recordedAfter : bounds.scheduledAfter;
  const before = recorded ? bounds.recordedBefore : bounds.scheduledBefore;
  if (after?.date === date && (time < after.time || (time === after.time && !after.inclusive))) {
    return { key: 'toasts.schedule.timeBeforeBound', bound: after };
  }
  if (before?.date === date && (time > before.time || (time === before.time && !before.inclusive))) {
    return { key: 'toasts.schedule.timeAfterBound', bound: before };
  }
  return undefined;
}
