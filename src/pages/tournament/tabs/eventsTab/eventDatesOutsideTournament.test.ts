import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { SET_EVENT_DATES } from 'constants/mutationConstants';
import { describe, expect, it } from 'vitest';
import {
  buildFitEventDatesMethod,
  fittedEventDates,
  getEventsWithDatesOutsideTournament,
} from './eventDatesOutsideTournament';

// a June day of the test tournament
const jun = (day: number) => `2026-06-${String(day).padStart(2, '0')}`;

const TOURNAMENT_START = jun(10);
const TOURNAMENT_END = jun(14);

// The engine refuses an event range outside the tournament's, so the stale range is written into the record, as an
// old record or one edited outside the engine carries it.
function seed(eventDates: { startDate: string; endDate: string; activeDates?: string[] }) {
  const { tournamentRecord } = mocksEngine.generateTournamentRecord({
    tournamentAttributes: { startDate: TOURNAMENT_START, endDate: TOURNAMENT_END },
    drawProfiles: [{ drawSize: 4 }],
  });
  Object.assign(tournamentRecord.events[0], eventDates);
  tournamentEngine.setState(tournamentRecord);
  return tournamentRecord.events[0].eventId;
}

describe('events whose dates lie outside the tournament', () => {
  it('reports nothing for an event inside the tournament range', () => {
    seed({ startDate: jun(11), endDate: jun(13) });
    expect(getEventsWithDatesOutsideTournament()).toEqual([]);
  });

  it('reports a disjoint range and fits it to the tournament range', () => {
    const eventId = seed({ startDate: jun(20), endDate: jun(22), activeDates: [jun(21)] });
    const [issue] = getEventsWithDatesOutsideTournament();
    expect(issue).toEqual(
      expect.objectContaining({
        tournamentStartDate: TOURNAMENT_START,
        tournamentEndDate: TOURNAMENT_END,
        startDate: jun(20),
        endDate: jun(22),
        disjoint: true,
        eventId,
      }),
    );
    expect(fittedEventDates(issue)).toEqual({ startDate: TOURNAMENT_START, endDate: TOURNAMENT_END });

    // the active date lies outside the new range, so it is dropped: setEventDates refuses it otherwise
    const method = buildFitEventDatesMethod(issue);
    expect(method).toEqual({
      method: SET_EVENT_DATES,
      params: { eventId, startDate: TOURNAMENT_START, endDate: TOURNAMENT_END, activeDates: [] },
    });

    const result: any = tournamentEngine.executionQueue([method]);
    expect(result.success).toBe(true);
    expect(getEventsWithDatesOutsideTournament()).toEqual([]);
  });

  it('clamps a range that crosses an edge, keeping the active dates inside it', () => {
    const eventId = seed({ startDate: jun(12), endDate: jun(16), activeDates: [jun(12), jun(13), jun(15)] });
    const [issue] = getEventsWithDatesOutsideTournament();
    expect(issue.disjoint).toBe(false);
    expect(fittedEventDates(issue)).toEqual({ startDate: jun(12), endDate: TOURNAMENT_END });

    const method = buildFitEventDatesMethod(issue);
    expect(method.params).toEqual({
      eventId,
      startDate: jun(12),
      endDate: TOURNAMENT_END,
      activeDates: [jun(12), jun(13)],
    });

    const result: any = tournamentEngine.executionQueue([method]);
    expect(result.success).toBe(true);
    expect(getEventsWithDatesOutsideTournament()).toEqual([]);
    expect(tournamentEngine.getEvent({ eventId }).event.activeDates).toEqual([jun(12), jun(13)]);
  });
});
