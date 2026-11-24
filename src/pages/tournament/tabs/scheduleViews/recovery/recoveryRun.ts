/**
 * Rain-day recovery, T2 (Mentat planning/RAIN_DAY_RECOVERY_PLAN.md § 4.2–4.5): project the target day on a working
 * copy and read it, under both release policies, side by side (CA 2026-11-23, Q3).
 *
 * Nothing here touches the live record, the shared engine or the server: the record is deep-copied, the carryover's
 * placements are cleared on the copy (the same clear the WARNING's modal makes), the recovery profile (T1) is set on it,
 * and the profile scheduler runs as a dry run against it through the schedule governor, which takes the copy as its
 * `tournamentRecords`. Never `mutationRequest`.
 *
 * - `ready`: the carryover first, then the target day's matchUps held to their imported starts.
 * - `finish`: a carryover-only run finds when the carryover ends; the full run then holds no target-day matchUp before
 *   that, nor before its own imported start.
 *
 * Durations and rest come from the scheduling policy (CA 2026-11-23, Q4) and are returned as the assumptions in force.
 */
import { buildRecoveryProfile, type RecoveryMatchUp, type ReleasePolicy } from './recoveryProfile';
import { queryGovernor, scheduleGovernor, tools } from 'tods-competition-factory';
import { compareRecovery, type RecoveryComparison } from './recoveryComparison';
import { projectRecoveryGrid } from './recoveryGrid';

export type RecoveryAssumption = {
  matchUpFormat?: string;
  averageMinutes?: number;
  recoveryMinutes?: number;
  matchUpIds: string[];
};

export type RecoveryProjection = {
  comparison: RecoveryComparison;
  /** the dry run's own result, for the reasons behind a matchUp left without a time */
  result: any;
  unvenuedMatchUpIds: string[];
  unroundedMatchUpIds: string[];
};

export type RecoveryRun = {
  ready: RecoveryProjection;
  finish: RecoveryProjection;
  /** the scheduling policy's minutes the runs used, by format */
  assumptions: RecoveryAssumption[];
  error?: any;
};

type RunRecoveryArgs = {
  scheduler?: RecoveryScheduler;
  /** the live records: read, never written */
  tournamentRecords: Record<string, any>;
  /** inContext matchUps: the carryover, oldest first (analyzeCarryover's order) */
  carryover: (RecoveryMatchUp & { matchUpFormat?: string })[];
  /** inContext matchUps scheduled on the target day without a result: their scheduledTime is the imported start */
  targetDay: (RecoveryMatchUp & { matchUpFormat?: string })[];
  scheduleDate: string;
  defaultVenueId?: string;
  /** the singles limit chosen in the panel: this run's daily limits, never stored */
  matchUpDailyLimits?: { [matchUpType: string]: number };
};

export type RecoveryScheduler = 'profile' | 'grid';

const CLEARED = { scheduledDate: '', scheduledTime: '', courtId: '', courtOrder: '', venueId: '' };

export function runRecovery({
  scheduler = 'profile',
  matchUpDailyLimits,
  tournamentRecords,
  defaultVenueId,
  scheduleDate,
  carryover,
  targetDay,
}: RunRecoveryArgs): RecoveryRun {
  const assumptions = policyAssumptions({ tournamentRecords, matchUps: [...carryover, ...targetDay] });
  const averageMinutes: { [matchUpId: string]: number | undefined } = {};
  for (const { matchUpIds, averageMinutes: minutes } of assumptions)
    for (const matchUpId of matchUpIds) averageMinutes[matchUpId] = minutes;

  // the working copy: the carryover loses the interrupted day's placement, as the WARNING's Clear would make it
  const workingCopy = scheduler === 'profile' ? tools.makeDeepCopy(tournamentRecords, false, true) : tournamentRecords;
  if (scheduler === 'profile' && carryover.length) {
    const cleared: any = scheduleGovernor.bulkScheduleMatchUps({
      matchUpDetails: carryover.map(({ tournamentId, matchUpId }) => ({ tournamentId, matchUpId, schedule: CLEARED })),
      tournamentRecords: workingCopy,
      removePriorValues: true,
    });
    if (cleared?.error) return failed(cleared.error, assumptions);
  }

  const project = (
    releasePolicy: ReleasePolicy,
    rounds: { carryover: RunRecoveryArgs['carryover']; targetDay: RunRecoveryArgs['targetDay'] },
    carryoverFinishTime?: string,
  ): RecoveryProjection | { error: any } => {
    const profile = buildRecoveryProfile({
      ...rounds,
      carryoverFinishTime,
      defaultVenueId,
      releasePolicy,
      scheduleDate,
    });
    const { schedulingProfile, unvenuedMatchUpIds, unroundedMatchUpIds } = profile;
    const result =
      scheduler === 'grid'
        ? projectRecoveryGrid({
            profile,
            carryover: rounds.carryover,
            targetDay: rounds.targetDay,
            scheduleDate,
            tournamentRecords: workingCopy,
            averageMinutes,
            matchUpDailyLimits,
            waitFor: new Set(releasePolicy === 'finish' ? carryover.map((m) => m.matchUpId) : []),
          })
        : timeProfileRounds({ tournamentRecords: workingCopy, schedulingProfile, scheduleDate, matchUpDailyLimits });
    if ('error' in result && result.error) return { error: result.error };
    const comparison = compareRecovery({
      ...rounds,
      averageMinutes,
      scheduleDate,
      result: 'placements' in result ? result : {},
    });
    return { comparison, result, unvenuedMatchUpIds, unroundedMatchUpIds };
  };

  const ready = project('ready', { carryover, targetDay });
  if ('error' in ready) return failed(ready.error, assumptions);

  // finish: when does the carryover end on its own? then hold the target day until then
  const alone = scheduler === 'grid' ? undefined : project('finish', { carryover, targetDay: [] });
  if (alone && 'error' in alone) return failed(alone.error, assumptions);
  const finish = project('finish', { carryover, targetDay }, alone?.comparison.carryoverFinishTime);
  if ('error' in finish) return failed(finish.error, assumptions);

  return { ready, finish, assumptions };
}

function timeProfileRounds({
  tournamentRecords,
  schedulingProfile,
  scheduleDate,
  matchUpDailyLimits,
}: Pick<RunRecoveryArgs, 'tournamentRecords' | 'scheduleDate' | 'matchUpDailyLimits'> & {
  schedulingProfile: ReturnType<typeof buildRecoveryProfile>['schedulingProfile'];
}) {
  const set = scheduleGovernor.setSchedulingProfile({ tournamentRecords, schedulingProfile });
  if (set.error) return { error: set.error };
  return scheduleGovernor.scheduleProfileRounds({
    tournamentRecords,
    matchUpDailyLimits,
    clearScheduleDates: [scheduleDate],
    scheduleDates: [scheduleDate],
    dryRun: true,
  });
}

/** the scheduling policy's average and recovery minutes for each format among the matchUps, from the live record */
function policyAssumptions({
  tournamentRecords,
  matchUps,
}: {
  tournamentRecords: Record<string, any>;
  matchUps: (RecoveryMatchUp & { matchUpFormat?: string })[];
}): RecoveryAssumption[] {
  const byFormat = new Map<string, RecoveryAssumption>();
  for (const matchUp of matchUps) {
    const tournamentRecord = matchUp.tournamentId ? tournamentRecords[matchUp.tournamentId] : undefined;
    const event = tournamentRecord?.events?.find(({ eventId }: any) => eventId === matchUp.eventId);
    // the matchUp's format, else its event's: the timing the scheduler reads for it
    const matchUpFormat: string | undefined = matchUp.matchUpFormat ?? event?.matchUpFormat;
    const key = [matchUp.tournamentId, matchUp.eventId, matchUpFormat ?? ''].join('|');
    if (!byFormat.has(key)) {
      // the event's own timing, when it states one, takes precedence over the tournament's policy; with no record or
      // no format there is nothing to look up, and the comparison flags the minutes as unknown
      const timing: any =
        tournamentRecord && matchUpFormat
          ? queryGovernor.getMatchUpFormatTiming({ tournamentRecord, matchUpFormat, event })
          : undefined;
      byFormat.set(key, {
        ...(matchUpFormat ? { matchUpFormat } : {}),
        recoveryMinutes: timing?.recoveryMinutes,
        averageMinutes: timing?.averageMinutes,
        matchUpIds: [],
      });
    }
    byFormat.get(key)!.matchUpIds.push(matchUp.matchUpId);
  }
  return [...byFormat.values()];
}

function failed(error: any, assumptions: RecoveryAssumption[]): RecoveryRun {
  const empty = { comparison: undefined as any, result: undefined, unvenuedMatchUpIds: [], unroundedMatchUpIds: [] };
  return { ready: empty, finish: empty, assumptions, error };
}
