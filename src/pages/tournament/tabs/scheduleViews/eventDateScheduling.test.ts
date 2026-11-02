import { competitionEngine, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';
import {
  EVENT_DATE_INACTIVE,
  collectEventDateSkips,
  eventDateExtensions,
  eventDateIssueEntries,
  inactivePlacements,
  placementDates,
  placementWarningMessage,
} from './eventDateScheduling';

/**
 * An event's playing days in the grid and the scheduling results, read from the real engine: the playing days from
 * `getEventPlayingDates`, the persistent issues from `getEventDateIssues`, and the skips from a real auto-schedule.
 * Fri 13 .. Mon 16 Nov 2026.
 */
const FRI = '2026-11-13';
const SAT = '2026-11-14';
const SUN = '2026-11-15';
const MON = '2026-11-16';

function seed() {
  const {
    tournamentRecord: { tournamentId },
    venueIds: [venueId],
    drawIds: [drawId],
    eventIds: [eventId],
  } = mocksEngine.generateTournamentRecord({
    drawProfiles: [{ drawSize: 16, eventName: 'Mixed 35+' }],
    venueProfiles: [{ courtsCount: 4, startTime: '08:00', endTime: '20:00' }],
    startDate: FRI,
    endDate: MON,
    setState: true,
  });
  const { matchUps } = tournamentEngine.allTournamentMatchUps({ matchUpFilters: { roundNumbers: [1] } });
  const matchUpIds = (matchUps ?? []).map((m: any) => m.matchUpId);
  return { tournamentId, venueId, drawId, eventId, matchUpIds };
}

function resolvers() {
  const { matchUps } = competitionEngine.allCompetitionMatchUps({ inContext: true });
  const byId = new Map((matchUps ?? []).map((m: any) => [m.matchUpId, m]));
  return {
    matchUpEventOf: (matchUpId: string) => {
      const m: any = byId.get(matchUpId);
      return m && { eventId: m.eventId, tournamentId: m.tournamentId, eventName: m.eventName };
    },
    playingDatesOf: ({ eventId, tournamentId }: any) =>
      competitionEngine.getEventPlayingDates({ eventId, tournamentId })?.playingDates,
  };
}

const place = (matchUpId: string, drawId: string, scheduledDate: string) => ({
  method: 'addMatchUpScheduleItems',
  params: { matchUpId, drawId, schedule: { scheduledDate }, removePriorValues: true },
});

describe('placementDates', () => {
  it('reads single, bulk and detailed placements, and ignores a cleared date', () => {
    expect(
      placementDates([
        { params: { matchUpId: 'a', schedule: { scheduledDate: FRI, courtId: 'c' } } },
        { params: { matchUpIds: ['b', 'c'], schedule: { scheduledTime: `${SAT}T10:00` } } },
        { params: { matchUpDetails: [{ matchUpId: 'd', schedule: { scheduledDate: SUN } }] } },
        { params: { matchUpId: 'e', schedule: { scheduledDate: '', courtId: '' } } },
        { params: { matchUpId: 'f', schedule: { scheduledTime: '10:00' } } },
      ]),
    ).toEqual([
      { matchUpId: 'a', date: FRI },
      { matchUpId: 'b', date: SAT },
      { matchUpId: 'c', date: SAT },
      { matchUpId: 'd', date: SUN },
    ]);
  });
});

describe('a grid placement on a day the event does not play', () => {
  it('is warned about before it runs, then lands, and stays an issue', () => {
    const { eventId, drawId, matchUpIds } = seed();
    let result: any = tournamentEngine.setEventDates({ eventId, weekdays: ['SAT', 'SUN'] });
    expect(result.success).toBe(true);

    const methods = [place(matchUpIds[0], drawId, FRI), place(matchUpIds[1], drawId, SAT)];
    const inactive = inactivePlacements({ methods, ...resolvers() });
    expect(inactive).toEqual([
      expect.objectContaining({ matchUpId: matchUpIds[0], eventId, date: FRI, playingDates: [SAT, SUN] }),
    ]);
    expect(placementWarningMessage(inactive)).toEqual(
      `Mixed 35+ does not play on ${FRI} (plays ${SAT}, ${SUN}). Placed anyway.`,
    );
    expect(placementWarningMessage([])).toBeUndefined();

    // the factory never refuses it: the write lands, with the warning on its result
    result = competitionEngine.executionQueue(methods);
    expect(result.success).toBe(true);
    const warnings = result.results.flatMap((r: any) => r.warnings ?? []);
    expect(warnings.map((w: any) => w.code)).toContain(EVENT_DATE_INACTIVE);

    // and the persistent issue the grid renders, whoever placed it
    const { eventDateIssues } = competitionEngine.getEventDateIssues({ scheduledDate: FRI });
    const entries = eventDateIssueEntries({
      eventDateIssues,
      labelOf: () => 'A vs B',
      eventNameOf: () => 'Mixed 35+',
    });
    expect(entries).toEqual([
      {
        severity: 'WARN',
        issueType: EVENT_DATE_INACTIVE,
        message: `A vs B: Mixed 35+ does not play on ${FRI} (not one of the event's days of the week)`,
        participants: 'A vs B',
        matchUpId: matchUpIds[0],
        date: FRI,
      },
    ]);
    expect(competitionEngine.getEventDateIssues({ scheduledDate: SAT }).eventDateIssues).toEqual([]);
  });

  it('counts the rest of a batch after the first', () => {
    const { eventId, drawId, matchUpIds } = seed();
    tournamentEngine.setEventDates({ eventId, activeDates: [SUN] });
    const methods = matchUpIds.slice(0, 3).map((id: string) => place(id, drawId, MON));
    const inactive = inactivePlacements({ methods, ...resolvers() });
    expect(inactive).toHaveLength(3);
    expect(placementWarningMessage(inactive)).toEqual(
      `Mixed 35+ does not play on ${MON} (plays ${SUN}). Placed anyway. (+2 more)`,
    );
  });

  it('says nothing for an unconstrained event or an unknown matchUp', () => {
    const { drawId, matchUpIds } = seed();
    const methods = [place(matchUpIds[0], drawId, FRI), place('unknown', drawId, FRI)];
    expect(inactivePlacements({ methods, ...resolvers() })).toEqual([]);
  });
});

describe('the auto-scheduler skips', () => {
  function profileAndRun({ tournamentId, venueId, drawId, eventId }: any, params: any = {}) {
    const { structureId } = tournamentEngine.getEvent({ drawId }).drawDefinition.structures[0];
    let result: any = competitionEngine.addSchedulingProfileRound({
      round: { tournamentId, eventId, drawId, structureId, roundNumber: 1 },
      scheduleDate: FRI,
      venueId,
    });
    expect(result.success).toBe(true);
    result = competitionEngine.scheduleProfileRounds({ scheduleDates: [FRI], ...params });
    expect(result.success).toBe(true);
    return result;
  }

  it('reports the skipped matchUps, and "schedule anyway" places them', () => {
    const seeded = seed();
    tournamentEngine.setEventDates({ eventId: seeded.eventId, weekdays: ['SAT', 'SUN'] });

    let result: any = profileAndRun(seeded);
    const skips = collectEventDateSkips(result);
    expect(skips.count).toEqual(8);
    expect([...skips.matchUpIds].sort((a, b) => a.localeCompare(b))).toEqual(
      [...seeded.matchUpIds].sort((a: string, b: string) => a.localeCompare(b)),
    );
    expect(skips.byDate[FRI].every((skip) => skip.reason === 'EVENT_WEEKDAY')).toBe(true);
    // a weekday is the director's choice: there is no range to extend
    expect(
      eventDateExtensions({ byDate: skips.byDate, eventOf: () => tournamentEngine.getEvent(seeded).event }),
    ).toEqual([]);

    result = competitionEngine.scheduleProfileRounds({ scheduleDates: [FRI], allowInactiveEventDates: true });
    expect(result.success).toBe(true);
    expect(collectEventDateSkips(result).count).toEqual(0);
    expect(result.scheduledMatchUpIds[FRI]).toHaveLength(8);
  });

  it('works out the event range that takes in days skipped as outside the event dates', () => {
    const seeded = seed();
    let result: any = tournamentEngine.setEventDates({ eventId: seeded.eventId, startDate: SAT, endDate: SUN });
    expect(result.success).toBe(true);

    result = profileAndRun(seeded);
    const { byDate, count } = collectEventDateSkips(result);
    expect(count).toEqual(8);
    expect(byDate[FRI][0].reason).toEqual('OUTSIDE_EVENT_DATES');

    const eventOf = (eventId: string) => tournamentEngine.getEvent({ eventId }).event;
    const extensions = eventDateExtensions({ byDate, eventOf });
    expect(extensions).toEqual([{ eventId: seeded.eventId, startDate: FRI, endDate: SUN }]);

    // the extension, applied as TMX applies it, lets the next run place them
    result = competitionEngine.executionQueue(extensions.map((params) => ({ method: 'setEventDates', params })));
    expect(result.success).toBe(true);
    result = competitionEngine.scheduleProfileRounds({ scheduleDates: [FRI] });
    expect(collectEventDateSkips(result).count).toEqual(0);
    expect(result.scheduledMatchUpIds[FRI]).toHaveLength(8);
  });

  it('collects nothing from a result without skips', () => {
    expect(collectEventDateSkips({}).count).toEqual(0);
    expect(collectEventDateSkips(undefined).byDate).toEqual({});
  });
});
