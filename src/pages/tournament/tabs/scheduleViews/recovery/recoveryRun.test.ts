import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';
import { runRecovery } from './recoveryRun';

const INTERRUPTED = '2026-11-21';
const TARGET = '2026-11-22';

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/**
 * Two 16-draws at one venue with 8 courts, 08:00 to 20:00. The interrupted day left draw A's round 1 unplayed at 16:30
 * (the carryover). The target day had imported draw A's round 2 at 13:00 and draw B's round 1 at 11:00.
 *
 * The profile scheduler paces starts (Garman): with eight courts and 90-minute matchUps it starts a round in waves
 * (11:00, 11:30, 12:00), not all at once. So a round's first wave can hold its imported start; the rest follow it.
 */
function setup() {
  const {
    drawIds: [drawA, drawB],
    venueIds: [venueId],
  } = mocksEngine.generateTournamentRecord({
    venueProfiles: [{ courtsCount: 8, startTime: '08:00', endTime: '20:00' }],
    drawProfiles: [{ drawSize: 16 }, { drawSize: 16 }],
    startDate: INTERRUPTED,
    endDate: '2026-11-23',
    setState: true,
  });
  const all = () => tournamentEngine.allTournamentMatchUps({ inContext: true }).matchUps ?? [];
  const round = (drawId: string, roundNumber: number) =>
    all().filter((matchUp: any) => matchUp.drawId === drawId && matchUp.roundNumber === roundNumber);
  const schedule = (matchUps: any[], scheduledDate: string, scheduledTime: string) => {
    for (const matchUp of matchUps) {
      const result: any = tournamentEngine.addMatchUpScheduleItems({
        schedule: { scheduledDate, scheduledTime, venueId },
        matchUpId: matchUp.matchUpId,
        drawId: matchUp.drawId,
      });
      expect(result.success).toEqual(true);
    }
  };
  schedule(round(drawA, 1), INTERRUPTED, '16:30');
  schedule(round(drawA, 2), TARGET, '13:00');
  schedule(round(drawB, 1), TARGET, '11:00');

  const ids = (matchUps: any[]) => matchUps.map(({ matchUpId }) => matchUpId);
  return {
    carryover: round(drawA, 1),
    targetDay: [...round(drawA, 2), ...round(drawB, 1)],
    drawB: ids(round(drawB, 1)),
    drawA2: ids(round(drawA, 2)),
    venueId,
  };
}

function run(setupResult: ReturnType<typeof setup>) {
  return runRecovery({
    tournamentRecords: tournamentEngine.getState().tournamentRecords,
    carryover: setupResult.carryover,
    targetDay: setupResult.targetDay,
    scheduleDate: TARGET,
  });
}

const projectedTimes = (projection: any) =>
  Object.fromEntries(
    projection.comparison.groups
      .flatMap((group: any) => group.rows)
      .map((row: any) => [row.matchUpId, row.projectedTime]),
  );

describe('runRecovery assumptions', () => {
  it("reports an event's own timing, not the tournament default, when the event states one", () => {
    const fixture = setup();
    const [carried] = fixture.carryover;
    const { matchUpFormat } = carried;
    expect(matchUpFormat).toBeDefined();
    const result: any = tournamentEngine.modifyEventMatchUpFormatTiming({
      recoveryMinutes: 30,
      averageMinutes: 60,
      eventId: carried.eventId,
      matchUpFormat,
    });
    expect(result.success).toEqual(true);

    const { assumptions } = run(fixture);
    const forCarried = assumptions.find((assumption) => assumption.matchUpIds.includes(carried.matchUpId));
    expect(forCarried).toMatchObject({ matchUpFormat, averageMinutes: 60, recoveryMinutes: 30 });
    // draw B's event states no timing of its own: it keeps the policy's
    const forDrawB = assumptions.find((assumption) => assumption.matchUpIds.includes(fixture.drawB[0]));
    expect(forDrawB).toMatchObject({ averageMinutes: 90, recoveryMinutes: 60 });
  });
});

describe('runRecovery', () => {
  it('projects both policies on a copy and leaves the live record alone', () => {
    const fixture = setup();
    const before = JSON.stringify(tournamentEngine.getState().tournamentRecords);

    const recovery = run(fixture);
    expect(recovery.error).toBeUndefined();
    expect(JSON.stringify(tournamentEngine.getState().tournamentRecords)).toEqual(before);

    // the scheduling policy's minutes are the assumptions in force
    expect(recovery.assumptions.length).toBeGreaterThan(0);
    for (const assumption of recovery.assumptions) {
      expect(assumption.averageMinutes).toEqual(90);
      expect(assumption.recoveryMinutes).toEqual(60);
    }
  });

  it('ready: the carryover starts at the opening, and the target day holds where it is free to', () => {
    const fixture = setup();
    const { ready } = run(fixture);
    const times = projectedTimes(ready);

    // all eight carried matchUps fit the eight courts at the opening; the interrupted day's 16:30 is not inherited
    for (const { matchUpId } of fixture.carryover) expect(times[matchUpId]).toEqual('08:00');
    expect(ready.comparison.carryoverFinishTime).toEqual('09:30');

    // draw B is independent of the carryover: never before its 11:00, and its first wave holds it exactly
    for (const matchUpId of fixture.drawB) expect(minutes(times[matchUpId])).toBeGreaterThanOrEqual(minutes('11:00'));
    const heldB = fixture.drawB.filter((matchUpId) => times[matchUpId] === '11:00');
    expect(heldB.length).toBeGreaterThan(0);
    expect(heldB.length).toBeLessThan(fixture.drawB.length);
    // draw A's round 2 waits for its carried feeders, and is never before its own imported 13:00
    for (const matchUpId of fixture.drawA2) expect(minutes(times[matchUpId])).toBeGreaterThanOrEqual(minutes('13:00'));

    expect(ready.comparison.timedTargetCount).toEqual(fixture.targetDay.length);
    // the count is the matchUps projected at exactly their imported start
    const holding = fixture.targetDay.filter(({ matchUpId }) =>
      ready.comparison.groups.some((group: any) =>
        group.rows.some((row: any) => row.matchUpId === matchUpId && row.holds),
      ),
    );
    expect(ready.comparison.startsHold).toEqual(holding.length);
    expect(ready.comparison.startsHold).toBeGreaterThanOrEqual(heldB.length);
    expect(ready.comparison.beyondDayMatchUpIds).toEqual([]);
  });

  it('finish: no target-day matchUp starts before the carryover is over', () => {
    const fixture = setup();
    const { ready, finish } = run(fixture);
    const finishTime = ready.comparison.carryoverFinishTime as string;
    const times = projectedTimes(finish);

    for (const { matchUpId } of fixture.targetDay) {
      expect(minutes(times[matchUpId])).toBeGreaterThanOrEqual(minutes(finishTime));
    }
    // the carryover itself is placed exactly as under ready
    for (const { matchUpId } of fixture.carryover) expect(times[matchUpId]).toEqual('08:00');
  });
});

describe('court grid recovery', () => {
  it('places the requested matches on their courts under each release policy without changing the live record', () => {
    const fixture = setup();
    const records = tournamentEngine.getState().tournamentRecords;
    const before = JSON.stringify(records);
    const grid = runRecovery({ ...fixture, tournamentRecords: records, scheduleDate: TARGET, scheduler: 'grid' });
    expect(grid.error).toBeUndefined();
    expect(JSON.stringify(records)).toBe(before);
    for (const projection of [grid.ready, grid.finish]) {
      const placements = projection.result.placements[TARGET][fixture.venueId];
      expect(placements.map((p: any) => p.matchUpId).sort()).toEqual(
        [...fixture.carryover, ...fixture.targetDay].map((m) => m.matchUpId).sort(),
      );
      expect(new Set(placements.map((p: any) => p.courtId + '/' + p.courtOrder)).size).toBe(placements.length);
      const times = projectedTimes(projection);
      expect(fixture.carryover.every((m) => times[m.matchUpId] === '08:00')).toBe(true);
      expect(fixture.drawB.every((id) => times[id] === '11:00')).toBe(true);
    }
  });
});

function gridDay(endTime = '17:00') {
  const {
    venueIds: [venueId, secondVenueId],
  } = mocksEngine.generateTournamentRecord({
    drawProfiles: [{ drawSize: 16 }],
    startDate: INTERRUPTED,
    endDate: TARGET,
    setState: true,
    venueProfiles: [
      { courtsCount: 1, startTime: '08:00', endTime },
      { courtsCount: 1, startTime: '08:00', endTime: '17:00' },
    ],
  });
  const engine = tournamentEngine;
  const { matchUps = [] } = engine.allTournamentMatchUps({ inContext: true, matchUpFilters: { roundNumbers: [1] } });
  const { courts = [] } = engine.getVenuesAndCourts();
  const courtId = courts.find((c) => c.venueId === venueId)!.courtId;
  const book = (index: number, date: string, scheduledTime?: string, venue = venueId, order?: number) => {
    const { matchUpId, drawId } = matchUps[index];
    const schedule = {
      scheduledDate: date,
      venueId: venue,
      scheduledTime,
      ...(order ? { courtId, courtOrder: order } : {}),
    };
    const result = engine.addMatchUpScheduleItems({ matchUpId, drawId, schedule });
    expect(result.success).toBe(true);
    return { ...matchUps[index], schedule };
  };
  const project = (carryover: ReturnType<typeof book>[], targetDay: ReturnType<typeof book>[], limit?: number) =>
    runRecovery({
      scheduler: 'grid',
      carryover,
      targetDay,
      scheduleDate: TARGET,
      tournamentRecords: engine.getState().tournamentRecords,
      matchUpDailyLimits: limit ? { SINGLES: limit } : undefined,
    });
  return { book, project, venueId, secondVenueId, courtId };
}

describe('court grid constraints', () => {
  it('keeps an existing booking and the order on its court, and holds an untimed target at another venue until release', () => {
    const { book, project, venueId, secondVenueId, courtId } = gridDay();
    book(0, TARGET, '10:00', venueId, 1);
    const stale = book(1, INTERRUPTED, '16:30');
    const target = book(2, TARGET, undefined, secondVenueId);
    const { ready, finish, error } = project([stale], [target], 2);
    expect(error).toBeUndefined();
    for (const run of [ready, finish]) {
      expect(run.result.placements[TARGET][venueId]).toMatchObject([
        { matchUpId: stale.matchUpId, courtId, courtOrder: 2, scheduleTime: '11:30' },
      ]);
      expect(run.result.placements[TARGET][secondVenueId][0].courtId).not.toBe(courtId);
    }
    expect(projectedTimes(ready)[target.matchUpId]).toBe('08:00');
    expect(projectedTimes(finish)[target.matchUpId]).toBe('13:00');
  });

  it('uses the target date’s opening hours when the venue opens late that day', () => {
    const { book, project, venueId } = gridDay();
    const update = tournamentEngine.modifyVenue({
      venueId,
      modifications: {
        dateAvailability: [
          { date: INTERRUPTED, startTime: '08:00', endTime: '17:00' },
          { date: TARGET, startTime: '12:00', endTime: '17:00' },
        ],
      },
    });
    expect(update.success).toBe(true);
    const carried = book(0, INTERRUPTED, '16:00');
    const recovery = project([carried], []);
    expect(recovery.error).toBeUndefined();
    expect(projectedTimes(recovery.ready)[carried.matchUpId]).toBe('12:00');
  });

  it('keeps the finish barrier closed when a carryover has no playable court window', () => {
    const { book, project, secondVenueId } = gridDay('08:30');
    const stale = book(0, INTERRUPTED, '16:00');
    const target = book(1, TARGET, '09:00', secondVenueId);
    const { ready, finish, error } = project([stale], [target]);
    expect(error).toBeUndefined();
    expect(ready.comparison.beyondDayMatchUpIds).toEqual([stale.matchUpId]);
    expect(projectedTimes(ready)[target.matchUpId]).toBe('09:00');
    expect(finish.comparison.beyondDayMatchUpIds).toEqual([stale.matchUpId, target.matchUpId]);
  });

  it('honors feeder rest and the singles limit when the next round moves to another venue', () => {
    const venue = { courtsCount: 2, startTime: '08:00', endTime: '18:00' };
    const {
      venueIds: [first, second],
    } = mocksEngine.generateTournamentRecord({
      drawProfiles: [{ drawSize: 4 }],
      startDate: INTERRUPTED,
      endDate: TARGET,
      setState: true,
      venueProfiles: [venue, { ...venue }],
    });
    const { matchUps = [] } = tournamentEngine.allTournamentMatchUps({ inContext: true });
    const carryover = matchUps.filter((m) => m.roundNumber === 1).map((m) => ({ ...m, schedule: { venueId: first } }));
    const targetDay = matchUps.filter((m) => m.roundNumber === 2).map((m) => ({ ...m, schedule: { venueId: second } }));
    expect(carryover).toHaveLength(2);
    expect(targetDay).toHaveLength(1);
    const args = {
      carryover,
      targetDay,
      tournamentRecords: tournamentEngine.getState().tournamentRecords,
      scheduleDate: TARGET,
      scheduler: 'grid' as const,
    };
    const grid = runRecovery(args);
    expect(grid.error).toBeUndefined();
    const times = projectedTimes(grid.ready);
    for (const feeder of carryover) {
      expect(minutes(times[targetDay[0].matchUpId]) - minutes(times[feeder.matchUpId])).toBeGreaterThanOrEqual(150);
    }
    const limited = runRecovery({ ...args, matchUpDailyLimits: { SINGLES: 1 } });
    expect(limited.error).toBeUndefined();
    expect(limited.ready.comparison.beyondDayMatchUpIds).toEqual([targetDay[0].matchUpId]);
  });

  it('leaves the original court cell reserved for an overflow target that will keep its imported schedule', () => {
    const { book, project, venueId } = gridDay('10:00');
    const stale = book(0, INTERRUPTED, '16:00');
    // It cannot fit 90 minutes at 09:30. Its original first row survives Make official.
    const target = book(1, TARGET, '09:30', venueId, 1);
    const { ready, error } = project([stale], [target]);
    expect(error).toBeUndefined();
    expect(ready.comparison.beyondDayMatchUpIds).toEqual([stale.matchUpId, target.matchUpId]);
  });
});
