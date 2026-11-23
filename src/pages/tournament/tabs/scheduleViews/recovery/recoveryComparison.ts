/**
 * Rain-day recovery, T3 (Mentat planning/RAIN_DAY_RECOVERY_PLAN.md § 4.5): one projection, read as the prototype reads
 * it. Pure: the caller hands in a dry run's result and the matchUps it was asked to place.
 *
 * - **carryover finish:** the latest carryover start plus its average minutes;
 * - **starts that hold:** target-day matchUps projected at their imported start;
 * - **need another day:** matchUps the run left without a time on the target day;
 * - **the table:** grouped by imported start, the carryover first, each group in projected order.
 */
import { importedStart, type RecoveryMatchUp } from './recoveryProfile';
import { tools } from 'tods-competition-factory';

export type RecoveryRunResult = {
  placements?: { [scheduleDate: string]: { [venueId: string]: { matchUpId: string; scheduleTime: string }[] } };
  noTimeMatchUpIds?: { [scheduleDate: string]: string[] };
};

export type RecoveryRow = {
  matchUpId: string;
  carryover: boolean;
  /** the target day's imported start; absent for the carryover */
  importedStart?: string;
  /** the projected start; absent when the run found it no time */
  projectedTime?: string;
  /** a target-day matchUp projected at its imported start */
  holds: boolean;
  beyondDay: boolean;
};

export type RecoveryGroup = { carryover: boolean; importedStart?: string; rows: RecoveryRow[] };

export type RecoveryComparison = {
  /** `HH:MM`; absent when no carryover matchUp was placed */
  carryoverFinishTime?: string;
  carryoverCount: number;
  /** target-day matchUps with an imported start, and how many of them hold it */
  startsHold: number;
  timedTargetCount: number;
  /** every matchUp asked about that the run left without a time */
  beyondDayMatchUpIds: string[];
  totalCount: number;
  groups: RecoveryGroup[];
  /** placed carryover matchUps with no average minutes: the finish leaves them out, so it may be early */
  unknownMinutesMatchUpIds: string[];
};

type RecoveryComparisonArgs = {
  result: RecoveryRunResult;
  scheduleDate: string;
  carryover: RecoveryMatchUp[];
  targetDay: RecoveryMatchUp[];
  /** each matchUp's average minutes, from the scheduling policy (the assumptions in force) */
  averageMinutes: { [matchUpId: string]: number | undefined };
};

const minutes = (time: string) => tools.dateTime.timeStringMinutes(time);
const byProjected = (a: RecoveryRow, b: RecoveryRow) =>
  (a.projectedTime ? minutes(a.projectedTime) : Infinity) - (b.projectedTime ? minutes(b.projectedTime) : Infinity);

export function compareRecovery({
  averageMinutes,
  scheduleDate,
  carryover,
  targetDay,
  result,
}: RecoveryComparisonArgs): RecoveryComparison {
  const projected = new Map<string, string>();
  for (const placements of Object.values(result.placements?.[scheduleDate] ?? {}))
    for (const { matchUpId, scheduleTime } of placements) projected.set(matchUpId, scheduleTime);
  const noTime = new Set(result.noTimeMatchUpIds?.[scheduleDate] ?? []);

  const row = (matchUp: RecoveryMatchUp, isCarryover: boolean): RecoveryRow => {
    const start = isCarryover ? undefined : importedStart(matchUp);
    const projectedTime = projected.get(matchUp.matchUpId);
    return {
      holds: !!start && !!projectedTime && minutes(projectedTime) === minutes(start),
      beyondDay: !projectedTime || noTime.has(matchUp.matchUpId),
      matchUpId: matchUp.matchUpId,
      carryover: isCarryover,
      ...(start ? { importedStart: start } : {}),
      ...(projectedTime ? { projectedTime } : {}),
    };
  };

  const carryoverRows = carryover.map((matchUp) => row(matchUp, true)).toSorted(byProjected);
  const targetRows = targetDay.map((matchUp) => row(matchUp, false));

  // the carryover's finish: its latest placed start plus that matchUp's own minutes
  let finish: number | undefined;
  const unknownMinutesMatchUpIds: string[] = [];
  for (const { matchUpId, projectedTime } of carryoverRows) {
    if (!projectedTime) continue;
    const duration = averageMinutes[matchUpId];
    if (!duration) unknownMinutesMatchUpIds.push(matchUpId);
    const end = minutes(projectedTime) + (duration ?? 0);
    if (finish === undefined || end > finish) finish = end;
  }

  const groups: RecoveryGroup[] = carryoverRows.length ? [{ carryover: true, rows: carryoverRows }] : [];
  const byStart = new Map<string, RecoveryRow[]>();
  for (const targetRow of targetRows) {
    const key = targetRow.importedStart ?? '';
    if (!byStart.has(key)) byStart.set(key, []);
    byStart.get(key)!.push(targetRow);
  }
  const starts = [...byStart.keys()].toSorted((a, b) => (a ? minutes(a) : Infinity) - (b ? minutes(b) : Infinity));
  for (const start of starts)
    groups.push({
      carryover: false,
      ...(start ? { importedStart: start } : {}),
      rows: byStart.get(start)!.toSorted(byProjected),
    });

  const timedTargetRows = targetRows.filter((targetRow) => targetRow.importedStart);
  return {
    carryoverFinishTime: finish === undefined ? undefined : formatMinutes(finish),
    beyondDayMatchUpIds: [...carryoverRows, ...targetRows].filter((r) => r.beyondDay).map((r) => r.matchUpId),
    startsHold: timedTargetRows.filter((targetRow) => targetRow.holds).length,
    totalCount: carryoverRows.length + targetRows.length,
    timedTargetCount: timedTargetRows.length,
    carryoverCount: carryoverRows.length,
    unknownMinutesMatchUpIds,
    groups,
  };
}

function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  return `${String(hours).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
