import { MODIFY_EVENT, SET_EVENT_DATES } from 'constants/mutationConstants';
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  EVENT_WEEKDAYS,
  buildSetEventDatesMethod,
  eventDatesRefusal,
  isCanonicalDate,
  normalizeWeekdays,
  parseActiveDates,
  weekdayLabelKey,
} from './eventDates';

// a June day of the test tournament
const jun = (day: number) => `2026-06-${String(day).padStart(2, '0')}`;

const TOURNAMENT_START = jun(1);
const TOURNAMENT_END = jun(10);
const tournamentDates = { tournamentStartDate: TOURNAMENT_START, tournamentEndDate: TOURNAMENT_END };

const eventId = 'event-dates';

beforeEach(() => {
  mocksEngine.generateTournamentRecord({ startDate: TOURNAMENT_START, endDate: TOURNAMENT_END, setState: true });
  const result: any = tournamentEngine.executionQueue([
    {
      method: 'addEvent',
      params: { event: { eventId, eventName: 'Event dates', startDate: jun(2), endDate: jun(8) } },
    },
  ]);
  expect(result.success).toBe(true);
});

const storedEvent = () => tournamentEngine.getEvent({ eventId }).event;

describe('event dates: pure helpers', () => {
  it('lists the factory weekdays Monday first, with short labels from i18n', () => {
    expect(EVENT_WEEKDAYS).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
    expect(weekdayLabelKey('MON')).toBe('i18n.weekdaysShort_1');
    expect(weekdayLabelKey('SUN')).toBe('i18n.weekdaysShort_0');
  });

  it('parses picker values into unique sorted dates', () => {
    expect(parseActiveDates(`${jun(5)}, ${jun(3)},${jun(5)},`)).toEqual([jun(3), jun(5)]);
    expect(parseActiveDates([jun(4), jun(2)])).toEqual([jun(2), jun(4)]);
    expect(parseActiveDates(undefined)).toEqual([]);
  });

  it('orders weekdays by calendar and keeps unknown codes for validation', () => {
    expect(normalizeWeekdays(['SUN', 'MON', 'WED'])).toEqual(['MON', 'WED', 'SUN']);
    expect(normalizeWeekdays(['XYZ', 'TUE'])).toEqual(['TUE', 'XYZ']);
  });

  it('checks dates the way the factory does', () => {
    expect(isCanonicalDate(jun(5))).toBe(true);
    expect(isCanonicalDate('2024-02-29')).toBe(true);
    expect(isCanonicalDate('2026-02-29')).toBe(false);
    expect(isCanonicalDate('2026-13-01')).toBe(false);
    expect(isCanonicalDate('2026-6-5')).toBe(false);
  });
});

describe('event dates: building the method', () => {
  it('sends nothing when active dates and weekdays are unchanged', () => {
    expect(buildSetEventDatesMethod({ eventId, activeDates: [], weekdays: [] })).toBeUndefined();
    expect(
      buildSetEventDatesMethod({
        eventId,
        activeDates: [jun(4), jun(3)],
        weekdays: ['SAT', 'FRI'],
        previous: { activeDates: [jun(3), jun(4)], weekdays: ['FRI', 'SAT'] },
      }),
    ).toBeUndefined();
  });

  it('round-trips active dates and weekdays through executionQueue alongside modifyEvent', () => {
    const startDate = jun(3);
    const endDate = jun(9);
    const activeDates = [jun(6), jun(4)];
    const weekdays = ['SAT', 'THU'];
    expect(eventDatesRefusal({ ...tournamentDates, startDate, endDate, activeDates, weekdays })).toBeUndefined();

    const setDates = buildSetEventDatesMethod({ eventId, startDate, endDate, activeDates, weekdays });
    expect(setDates).toEqual({
      method: SET_EVENT_DATES,
      params: { eventId, startDate, endDate, activeDates: [jun(4), jun(6)], weekdays: ['THU', 'SAT'] },
    });

    let result: any = tournamentEngine.executionQueue([
      { method: MODIFY_EVENT, params: { eventId, eventUpdates: { eventName: 'Event dates', startDate, endDate } } },
      setDates,
    ]);
    expect(result.success).toBe(true);

    let event: any = storedEvent();
    expect(event.startDate).toBe(startDate);
    expect(event.endDate).toBe(endDate);
    expect(event.activeDates).toEqual([jun(4), jun(6)]);
    expect(event.weekdays).toEqual(['THU', 'SAT']);

    // clearing both sends empty lists, which the factory stores
    const clear = buildSetEventDatesMethod({
      eventId,
      startDate,
      endDate,
      activeDates: [],
      weekdays: [],
      previous: { activeDates: event.activeDates, weekdays: event.weekdays },
    });
    expect(clear?.params).toMatchObject({ activeDates: [], weekdays: [] });
    result = tournamentEngine.executionQueue([clear]);
    expect(result.success).toBe(true);
    event = storedEvent();
    expect(event.activeDates).toEqual([]);
    expect(event.weekdays).toEqual([]);
  });

  it('a new event takes its active dates in the same batch as addEvent', () => {
    const newEventId = 'new-event-with-active-dates';
    const setDates = buildSetEventDatesMethod({
      eventId: newEventId,
      startDate: jun(1),
      endDate: jun(5),
      activeDates: [jun(2)],
      weekdays: ['TUE'],
    });
    let result: any = tournamentEngine.executionQueue([
      {
        method: 'addEvent',
        params: {
          event: { eventId: newEventId, eventName: 'New event', startDate: jun(1), endDate: jun(5) },
        },
      },
      setDates,
    ]);
    expect(result.success).toBe(true);
    const { event } = tournamentEngine.getEvent({ eventId: newEventId });
    expect(event.activeDates).toEqual([jun(2)]);
    expect(event.weekdays).toEqual(['TUE']);
  });
});

describe('event dates: local refusals match the factory', () => {
  // `writesBeforeRefusing`: the factory applies the start date before it refuses the end date, so
  // the refusal leaves a partial write. The local pre-check is what keeps TMX from sending it.
  const cases: { name: string; values: any; refusal: string; writesBeforeRefusing?: boolean }[] = [
    {
      name: 'an active date before the event start',
      values: { startDate: jun(3), endDate: jun(8), activeDates: [jun(2)] },
      refusal: 'ACTIVE_DATE_OUTSIDE_EVENT',
    },
    {
      name: 'an active date after the event end',
      values: { startDate: jun(3), endDate: jun(8), activeDates: [jun(9)] },
      refusal: 'ACTIVE_DATE_OUTSIDE_EVENT',
    },
    {
      name: 'an active date that is not a calendar day',
      values: { startDate: jun(3), endDate: jun(8), activeDates: [jun(31)] },
      refusal: 'INVALID_DATE',
    },
    {
      name: 'an unknown weekday',
      values: { startDate: jun(3), endDate: jun(8), weekdays: ['MON', 'XYZ'] },
      refusal: 'INVALID_WEEKDAYS',
    },
    {
      name: 'a repeated weekday',
      values: { startDate: jun(3), endDate: jun(8), weekdays: ['MON', 'MON'] },
      refusal: 'INVALID_WEEKDAYS',
    },
    {
      name: 'a start after the end',
      values: { startDate: jun(8), endDate: jun(3) },
      refusal: 'START_AFTER_END',
    },
    {
      name: 'an end outside the tournament',
      values: { startDate: jun(3), endDate: jun(12) },
      refusal: 'OUTSIDE_TOURNAMENT',
      writesBeforeRefusing: true,
    },
  ];

  for (const { name, values, refusal, writesBeforeRefusing } of cases) {
    it(`refuses ${name}, as the factory does`, () => {
      expect(eventDatesRefusal({ ...tournamentDates, ...values })).toBe(refusal);

      const before = storedEvent();
      const result: any = tournamentEngine.executionQueue([
        { method: SET_EVENT_DATES, params: { eventId, activeDates: [], weekdays: [], ...values } },
      ]);
      expect(result.error).toBeDefined();
      const after = storedEvent();
      if (!writesBeforeRefusing) expect(after.startDate).toBe(before.startDate);
      expect(after.endDate).toBe(before.endDate);
      expect(after.activeDates).toBeUndefined();
      expect(after.weekdays).toBeUndefined();
    });
  }
});
