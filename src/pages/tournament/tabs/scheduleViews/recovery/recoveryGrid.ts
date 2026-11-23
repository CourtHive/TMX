// The grid chooses the court and order. Factory's timer qualifies a start on that court against
// availability, bookings, participant rest and daily limits before the placement enters the plan.
import { queryGovernor, scheduleGovernor, tools, type TournamentRecords, type Venue } from 'tods-competition-factory';

// constants and types
import type { RecoveryProfileRound, RecoveryProfile, RecoveryMatchUp } from './recoveryProfile';
import type { ProjectedPlacement, RecoveryRunResult } from './recoveryComparison';

type GridArgs = {
  tournamentRecords: TournamentRecords;
  scheduleDate: string;
  profile: RecoveryProfile;
  matchUpDailyLimits?: Record<string, number>;
  averageMinutes: Record<string, number | undefined>;
  waitFor: Set<string>;
};

type Cell = { matchUpId: string; courtId: string; courtOrder: number; venueId: string; round: RecoveryProfileRound };
type Occupant = { courtId: string; order: number; start?: number; end?: number };
type Projection = RecoveryRunResult & { error?: unknown };

const minutes = tools.dateTime.timeStringMinutes;

function assignGridCells(args: GridArgs, retained: Set<string>) {
  const { scheduleDate, profile, matchUpDailyLimits } = args;
  const records = tools.makeDeepCopy(args.tournamentRecords, false, true);
  const hydrated = queryGovernor.allCompetitionMatchUps({
    tournamentRecords: records,
    inContext: true,
    afterRecoveryTimes: true,
    nextMatchUps: true,
  });
  if (hydrated.error) return { error: hydrated.error };
  const { matchUps = [] } = hydrated;
  const byId = new Map(matchUps.map((m) => [m.matchUpId, m]));
  const facilities = queryGovernor.getVenuesAndCourts({
    tournamentRecords: records,
    dates: [scheduleDate],
    ignoreDisabled: true,
  });
  if (facilities.error) return { error: facilities.error };
  const { courts = [] } = facilities;
  const names = new Map(courts.map((court) => [court.courtId, court.courtName || court.courtId]));
  const limits = matchUpDailyLimits
    ? { matchUpDailyLimits }
    : queryGovernor.getMatchUpDailyLimits({ tournamentRecords: records });
  const dependencies = queryGovernor.getMatchUpDependencies({ tournamentRecords: records, matchUps });
  if (dependencies.error) return { error: dependencies.error };
  const { matchUpDependencies = {} } = dependencies;
  const occupied: Occupant[] = [];
  for (const { schedule } of matchUps) {
    if (schedule?.scheduledDate !== scheduleDate || !schedule.courtId || !schedule.courtOrder) continue;
    const start = schedule.scheduledTime ? minutes(schedule.scheduledTime) : undefined;
    const end = start !== undefined && schedule.averageMinutes ? start + schedule.averageMinutes : undefined;
    occupied.push({ courtId: schedule.courtId, order: Number(schedule.courtOrder), start, end });
  }
  const cells: Cell[] = [];
  for (const { venueId, rounds } of profile.schedulingProfile[0].venues) {
    const courtIds = courts.filter((court) => court.venueId === venueId).map((court) => court.courtId);
    if (!courtIds.length) continue;
    const roundOf = new Map(rounds.flatMap((round) => round.matchUpIds.map((id) => [id, round] as const)));
    const candidates = [...roundOf.keys()].filter((id) => !retained.has(id)).flatMap((id) => byId.get(id) ?? []);
    if (!candidates.length) continue;
    // scheduleProfileGrid selects whole rounds. Use its placement operation with the requested IDs
    // so another match in the same round cannot consume a cell, and each venue keeps its own courts.
    const grid = scheduleGovernor.proAutoSchedule({
      ...limits,
      tournamentRecords: records,
      scheduledDate: scheduleDate,
      courtIds,
      minCourtGridRows: Math.max(10, candidates.length * 2),
      matchUps: candidates,
    });
    if (grid.error) return { error: grid.error };
    for (const { matchUpId, schedule } of grid.scheduled ?? []) {
      if (schedule?.courtId && schedule.courtOrder)
        cells.push({
          matchUpId,
          venueId,
          courtId: schedule.courtId,
          courtOrder: Number(schedule.courtOrder),
          round: roundOf.get(matchUpId)!,
        });
    }
  }
  return { cells, occupied, names, matchUpDependencies };
}

// A fixed earlier row bounds the start and a later one bounds the finish. A fixed match with no
// known time cannot establish a safe window on that side of the new cell.
function courtWindow(cell: Cell, occupied: Occupant[]) {
  let earliest = 0;
  let latest = 24 * 60;
  for (const entry of occupied) {
    if (entry.courtId !== cell.courtId) continue;
    if (entry.order < cell.courtOrder) earliest = Math.max(earliest, entry.end ?? Infinity);
    if (entry.order > cell.courtOrder) latest = Math.min(latest, entry.start ?? 0);
  }
  return { earliest, latest };
}

// Start this court's clock at the release floor. Otherwise the one-court profile timer paces
// from opening time and a free 09:00 court can offer only the next 09:30 wave.
function releasedVenue(venue: Venue, scheduleDate: string, floor: string): Venue {
  const release = (time?: string) => (time && minutes(time) > minutes(floor) ? time : floor);
  return {
    ...venue,
    defaultStartTime: release(venue.defaultStartTime),
    dateAvailability: venue.dateAvailability?.map((window) =>
      window.date && window.date !== scheduleDate ? window : { ...window, startTime: release(window.startTime) },
    ),
  };
}

function courtReleasedAt(
  records: TournamentRecords,
  cell: Cell,
  scheduleDate: string,
  floor: string,
): TournamentRecords {
  // The timer filters to cell.courtId and intersects that court's availability with its venue's.
  // Raising the venue opening in this read also covers courts that inherit their opening hours.
  return Object.fromEntries(
    Object.entries(records).map(([id, record]) => [
      id,
      {
        ...record,
        venues: record.venues?.map((venue) =>
          venue.venueId === cell.venueId ? releasedVenue(venue, scheduleDate, floor) : venue,
        ),
      },
    ]),
  );
}

function timeGridCell(args: GridArgs, cell: Cell, occupied: Occupant[], release: number) {
  const { scheduleDate, tournamentRecords, matchUpDailyLimits } = args;
  const { courtId, courtOrder, matchUpId, round, venueId } = cell;
  const duration = args.averageMinutes[matchUpId];
  if (!duration) return {};
  const { earliest, latest } = courtWindow(cell, occupied);
  const floor = Math.max(earliest, release, round.notBeforeTime ? minutes(round.notBeforeTime) : 0);
  if (floor + duration > latest) return {};
  const notBeforeTime = tools.dateTime.addMinutesToTimeString('00:00', floor);
  const singleRound = { ...round, matchUpIds: [matchUpId], notBeforeTime };
  const set = scheduleGovernor.setSchedulingProfile({
    tournamentRecords,
    schedulingProfile: [{ scheduleDate, venues: [{ venueId, rounds: [singleRound] }] }],
  });
  if (set.error) return { error: set.error };
  const run = scheduleGovernor.scheduleProfileRounds({
    tournamentRecords: courtReleasedAt(tournamentRecords, cell, scheduleDate, notBeforeTime),
    scheduleDates: [scheduleDate],
    courtIds: [courtId],
    matchUpDailyLimits,
    dryRun: true,
  });
  if ('error' in run && run.error) return { error: run.error };
  if (!('placements' in run)) return {};
  const slot = run.placements?.[scheduleDate]?.[venueId]?.find((p) => p.matchUpId === matchUpId);
  if (!slot) return {};
  const scheduledTime = slot.scheduleTime;
  const start = minutes(scheduledTime);
  const end = start + duration;
  if (start < floor || end > latest) return {};
  const schedule = { courtId, courtOrder, venueId, scheduledTime, scheduledDate: scheduleDate };
  const write = scheduleGovernor.bulkScheduleMatchUps({
    tournamentRecords,
    matchUpDetails: [
      {
        tournamentId: round.tournamentId,
        matchUpId,
        schedule,
      },
    ],
  });
  if (write.error) return { error: write.error };
  occupied.push({ courtId, order: courtOrder, start, end });
  return { end, scheduledTime };
}

function projectGridPass(args: GridArgs, retained: Set<string>): Projection {
  const grid = assignGridCells(args, retained);
  if ('error' in grid) return { error: grid.error };
  const { cells, occupied, names, matchUpDependencies } = grid;
  const requested = new Set(
    args.profile.schedulingProfile[0].venues.flatMap((venue) => venue.rounds.flatMap((round) => round.matchUpIds)),
  );
  const result: Record<string, ProjectedPlacement[]> = {};
  const timed = new Set<string>();
  const pendingCarryover = new Set(args.waitFor);
  let carryoverEnds = 0;
  const pending = cells.sort((a, b) => a.courtOrder - b.courtOrder);
  while (pending.length) {
    const next = pending.findIndex(
      ({ matchUpId }) =>
        (!pendingCarryover.size || pendingCarryover.has(matchUpId)) &&
        !matchUpDependencies[matchUpId]?.matchUpIds?.some((id) => requested.has(id) && !timed.has(id)),
    );
    if (next < 0) break;
    const [cell] = pending.splice(next, 1);
    const carried = args.waitFor.has(cell.matchUpId);
    const slot = timeGridCell(args, cell, occupied, carried ? 0 : carryoverEnds);
    if (slot.error) return { error: slot.error };
    if (slot.end === undefined || !slot.scheduledTime) continue;
    if (carried) {
      pendingCarryover.delete(cell.matchUpId);
      carryoverEnds = Math.max(carryoverEnds, slot.end);
    }
    timed.add(cell.matchUpId);
    const { matchUpId, courtOrder, courtId, venueId } = cell;
    (result[venueId] ??= []).push({
      matchUpId,
      scheduleTime: slot.scheduledTime,
      courtId,
      courtOrder,
      courtName: names.get(courtId),
    });
  }
  return { placements: { [args.scheduleDate]: result } };
}

// An overflow target keeps its official booking when saved. Replan around those reservations until
// no additional target drops out. Every retry retains at least one more target from the finite set.
export function projectRecoveryGrid(
  args: GridArgs & { carryover: RecoveryMatchUp[]; targetDay: RecoveryMatchUp[] },
): Projection {
  const retained = new Set<string>();
  for (;;) {
    const records = tools.makeDeepCopy(args.tournamentRecords, false, true);
    const targets = args.targetDay.filter((m) => !retained.has(m.matchUpId));
    const clear = scheduleGovernor.bulkScheduleMatchUps({
      tournamentRecords: records,
      removePriorValues: true,
      matchUpDetails: [...args.carryover, ...targets].map(({ matchUpId, tournamentId }) => ({
        tournamentId,
        matchUpId,
        schedule: { scheduledDate: '', scheduledTime: '', venueId: '', courtId: '', courtOrder: '' },
      })),
    });
    if (clear.error) return { error: clear.error };
    const projection = projectGridPass({ ...args, tournamentRecords: records }, retained);
    if (projection.error) return projection;
    const placed = new Set(
      Object.values(projection.placements?.[args.scheduleDate] ?? {})
        .flat()
        .map((p) => p.matchUpId),
    );
    const overflow = targets.filter((m) => !placed.has(m.matchUpId));
    if (!placed.size || !overflow.length) return projection;
    for (const m of overflow) retained.add(m.matchUpId);
  }
}
