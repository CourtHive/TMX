/**
 * What the schedule grid's cell panel shows for a matchUp that is already over.
 *
 * CA, 2026-10-12: "given that the matchUp is completed, none of the annotations need to be shown, setting the
 * time does not need to be shown, and under time, if there is a calledAt time it should be shown and the
 * scoredAt time should be shown, if there is no endTime."
 *
 * "Completed" is every finished status, the factory's `completedMatchUpStatuses` (CA, 2026-10-11) — a WALKOVER
 * or a RETIRED is as over as a COMPLETED. It is deliberately neither `hasFinalResult` (a winner, or COMPLETED)
 * nor the panel's `TERMINAL_MATCHUP_STATUSES`, which leaves out COMPLETED on purpose.
 *
 * "scoredAt" is the factory's `schedule.scoredTime`: stamped the first time a result is recorded, kept through
 * corrections, cleared when the result is removed. It is when the score was ENTERED, not when play ended, so it
 * is shown only when there is no `endTime`, and a record scored before the field existed simply has none —
 * `updatedAt` moves on any change and is never a stand-in.
 *
 * Kept free of the DOM so the decision is unit-tested in node; the panel only renders what this returns.
 */
import { venueClock, venueTimeZone } from 'functions/venueTimeFrame';
import { factoryConstants, tools } from 'tods-competition-factory';

const COMPLETED_STATUSES = new Set<string>(factoryConstants.completedMatchUpStatuses);

export type CompletedTimeKey = 'calledAt' | 'startTime' | 'endTime' | 'scoredTime';
export type CompletedTime = { key: CompletedTimeKey; clock: string };

type PanelSchedule = { calledAt?: string; startTime?: string; endTime?: string; scoredTime?: string };

export function isCompletedMatchUp(matchUpStatus?: string): boolean {
  return !!matchUpStatus && COMPLETED_STATUSES.has(matchUpStatus);
}

/**
 * An instant (`calledAt`, `scoredTime`) on the venue's clock; nothing for an absent stamp. The zone is resolved
 * here because `venueClock` given none reads the BROWSER's zone, not the tournament's.
 */
function instantClock(value: string | undefined, timeZone: string): string {
  return value ? venueClock(value, timeZone) : '';
}

/** A naive venue wall clock (`startTime`, `endTime`), already in venue terms: only the `HH:MM` is read. */
function wallClock(value?: string): string {
  return (value && tools.dateTime.convertTime(value, true)) || '';
}

/**
 * The times a completed matchUp's panel states as facts, in the order they happened. A time that is absent or
 * unreadable is left out rather than shown as a guess.
 */
export function completedMatchUpTimes(schedule?: PanelSchedule, timeZone = venueTimeZone()): CompletedTime[] {
  const endClock = wallClock(schedule?.endTime);
  const candidates: CompletedTime[] = [
    { key: 'calledAt', clock: instantClock(schedule?.calledAt, timeZone) },
    { key: 'startTime', clock: wallClock(schedule?.startTime) },
    { key: 'endTime', clock: endClock },
    { key: 'scoredTime', clock: endClock ? '' : instantClock(schedule?.scoredTime, timeZone) },
  ];
  return candidates.filter(({ clock }) => !!clock);
}

export type CellPanelLayout = {
  completed: boolean;
  /** The ANNOTATIONS section (Followed by, Next available, …). */
  showAnnotations: boolean;
  /** The [Set time] pill. */
  showSetTime: boolean;
  /** [Call to court] and [Start match]: nothing left to call or start once the matchUp is over. */
  allowCallAndStart: boolean;
  /** Read-only times under TIME; empty for a matchUp that is not completed. */
  times: CompletedTime[];
};

/** A matchUp that is not completed keeps today's panel exactly; [Start time] / [End time] stay editable either way. */
export function cellPanelLayout(
  matchUp?: { matchUpStatus?: string; schedule?: PanelSchedule },
  timeZone?: string,
): CellPanelLayout {
  const completed = isCompletedMatchUp(matchUp?.matchUpStatus);
  return {
    completed,
    showAnnotations: !completed,
    showSetTime: !completed,
    allowCallAndStart: !completed,
    times: completed ? completedMatchUpTimes(matchUp?.schedule, timeZone) : [],
  };
}
