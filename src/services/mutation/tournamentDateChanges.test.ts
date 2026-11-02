import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { tournamentDateChangeLines } from './tournamentDateChanges';
import { describe, expect, it } from 'vitest';

/**
 * The notice reads what the real `setTournamentDates` returned, run through executionQueue as mutationRequest
 * runs it; the method result is `results[0]`.
 */
const START = '2026-06-01';
const END = '2026-06-07';
const DAY_2 = '2026-06-02';
const DAY_3 = '2026-06-03';
const DAY_5 = '2026-06-05';

function seed({ eventsCount = 2 }: { eventsCount?: number } = {}) {
  const {
    eventIds,
    venueIds: [venueId],
  } = mocksEngine.generateTournamentRecord({
    eventProfiles: Array.from({ length: eventsCount }, (_, i) => ({ eventName: `Event ${i + 1}` })),
    venueProfiles: [{ courtsCount: 2 }],
    startDate: START,
    endDate: END,
    setState: true,
  });
  return { eventIds, venueId };
}

function changeDates(params: any) {
  let result: any = tournamentEngine.executionQueue([{ method: 'setTournamentDates', params }]);
  expect(result.success).toBe(true);
  return result.results[0];
}

const eventName = (eventId: string) => tournamentEngine.getEvent({ eventId })?.event?.eventName;

describe('tournamentDateChangeLines', () => {
  it('says nothing when only the dates changed', () => {
    seed({ eventsCount: 0 });
    const result = changeDates({ startDate: START, endDate: '2026-06-08' });
    expect(tournamentDateChangeLines({ result, eventName })).toEqual([]);
  });

  it('lists an event that followed the tournament, and one cut to it', () => {
    const {
      eventIds: [trackedId, clampedId],
    } = seed();
    let result: any = tournamentEngine.setEventDates({
      eventId: clampedId,
      startDate: DAY_2,
      endDate: DAY_5,
    });
    expect(result.success).toBe(true);

    result = changeDates({ startDate: DAY_3, endDate: '2026-06-09' });
    const reasons = Object.fromEntries(result.eventDateChanges.map((c: any) => [c.eventId, c.reason]));
    expect(reasons[clampedId]).toEqual('CLAMPED');

    const lines = tournamentDateChangeLines({ result, eventName });
    const eventLines = lines.filter((line) => line.kind === 'eventDates');
    expect(eventLines).toHaveLength(result.eventDateChanges.length);
    expect(eventLines.every((line) => !line.warning)).toBe(true);
    const clamped = eventLines.find((line) => line.text.startsWith('Event 2'));
    expect(clamped?.text).toEqual('Event 2: dates cut to 2026-06-03 – 2026-06-05 (was 2026-06-02 – 2026-06-05)');
    expect(reasons[trackedId]).toEqual('TRACKED');
    const tracked = eventLines.find((line) => line.text.startsWith('Event 1'));
    expect(tracked?.text).toEqual(
      'Event 1: dates follow the tournament, now 2026-06-03 – 2026-06-09 (was 2026-06-01 – 2026-06-07)',
    );
  });

  it('lists an event reset to the tournament when its range lay entirely outside', () => {
    const {
      eventIds: [, eventId],
    } = seed();
    tournamentEngine.setEventDates({ eventId, startDate: START, endDate: DAY_2 });

    const result = changeDates({ startDate: '2026-06-04', endDate: '2026-06-07' });
    const line = tournamentDateChangeLines({ result, eventName }).find((l) => l.text.startsWith('Event 2'));
    expect(line?.text).toEqual(
      'Event 2: dates were outside the tournament, reset to 2026-06-04 – 2026-06-07 (was 2026-06-01 – 2026-06-02)',
    );
  });

  it('lists pruned active dates, and warns when a list was emptied and unset', () => {
    const {
      eventIds: [prunedId, unsetId],
    } = seed();
    let result: any = tournamentEngine.setEventDates({
      activeDates: [START, DAY_5],
      eventId: prunedId,
    });
    expect(result.success).toBe(true);
    result = tournamentEngine.setEventDates({ activeDates: [START, DAY_2], eventId: unsetId });
    expect(result.success).toBe(true);

    result = changeDates({ startDate: DAY_3, endDate: END });
    const changes = Object.fromEntries(result.activeDateChanges.map((c: any) => [c.eventId, c]));
    expect(changes[prunedId].activeDates).toEqual([DAY_5]);
    expect(changes[unsetId].activeDates).toBeUndefined();

    const lines = tournamentDateChangeLines({ result, eventName });
    expect(lines).toContainEqual({
      kind: 'activeDates',
      warning: false,
      text: 'Event 1: active dates removed: 2026-06-01',
    });
    expect(lines).toContainEqual({
      kind: 'activeDatesUnset',
      warning: true,
      text:
        'Event 2: every active date was outside the new dates (2026-06-01, 2026-06-02), so it now plays every day; ' +
        'set active dates again if needed',
    });
    expect(lines.filter((line) => line.warning)).toHaveLength(1);
  });

  it("names the tournament's own active-date list", () => {
    seed({ eventsCount: 0 });
    let result: any = tournamentEngine.setTournamentDates({ activeDates: [START, DAY_2] });
    expect(result.success).toBe(true);

    result = changeDates({ startDate: DAY_2, endDate: END });
    const lines = tournamentDateChangeLines({ result, eventName });
    expect(lines).toEqual([
      { kind: 'activeDates', warning: false, text: 'Tournament: active dates removed: 2026-06-01' },
    ]);

    result = changeDates({ startDate: DAY_3, endDate: END });
    const [unset] = tournamentDateChangeLines({ result, eventName });
    expect(unset.kind).toEqual('activeDatesUnset');
    expect(unset.warning).toBe(true);
    expect(unset.text.startsWith('Tournament: every active date was outside the new dates (2026-06-02)')).toBe(true);
  });

  it('lists scheduling-profile dates that left with the range', () => {
    const {
      venueIds: [venueId],
      drawIds: [drawId],
      eventIds: [eventId],
      tournamentRecord: { tournamentId },
    } = mocksEngine.generateTournamentRecord({
      drawProfiles: [{ drawSize: 8 }],
      venueProfiles: [{ courtsCount: 2 }],
      startDate: START,
      endDate: END,
      setState: true,
    });
    const { structureId } = tournamentEngine.getEvent({ drawId }).drawDefinition.structures[0];
    for (const [scheduleDate, roundNumber] of [
      [START, 1],
      [DAY_2, 2],
    ] as const) {
      let result: any = tournamentEngine.addSchedulingProfileRound({
        round: { tournamentId, eventId, drawId, structureId, roundNumber },
        scheduleDate,
        venueId,
      });
      expect(result.success).toBe(true);
    }

    const result = changeDates({ startDate: DAY_2, endDate: END });
    expect(result.trimmedSchedulingProfile).toHaveLength(1);
    expect(tournamentDateChangeLines({ result, eventName })).toContainEqual({
      kind: 'profile',
      warning: false,
      text: 'Scheduling profile: 2026-06-01 removed, rounds: 1',
    });
  });

  it('counts matchUps a forced change unscheduled, and says nothing for a refusal', () => {
    expect(tournamentDateChangeLines({ result: { error: { message: 'x' } } })).toEqual([]);
    expect(tournamentDateChangeLines({ result: undefined })).toEqual([]);
    expect(tournamentDateChangeLines({ result: { success: true, unscheduledMatchUpIds: ['a', 'b'] } })).toEqual([
      { kind: 'unscheduled', warning: false, text: 'MatchUps unscheduled: 2' },
    ]);
  });
});
