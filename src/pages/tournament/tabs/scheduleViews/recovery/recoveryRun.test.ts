import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { runRecovery } from './recoveryRun';
import { describe, expect, it } from 'vitest';

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
