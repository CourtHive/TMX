import { addCalendarDays, dayOpening, prepTime, warpClockDates, warpExitPath, warpLastDate } from './warpClockRange';
import { describe, expect, it } from 'vitest';

const [SUN, MON, TUE, WED] = ['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25'];
const COPY = 'warp-copy';
const SOURCE = 'source';
const RECORD = {
  events: [
    {
      eventId: 'e1',
      drawDefinitions: [{ drawId: 'd1', structures: [{ structureId: 's1' }] }],
    },
  ],
};

describe('warp clock dates', () => {
  it('adds calendar days across a month end', () => {
    expect(addCalendarDays('2026-11-30', 1)).toEqual('2026-12-01');
    expect(warpLastDate(TUE)).toEqual(WED);
    expect(warpLastDate(undefined)).toBeUndefined();
  });

  it('runs from the clock day to the day after the end', () => {
    expect(warpClockDates({ clockDate: SUN, endDate: TUE })).toEqual([SUN, MON, TUE, WED]);
  });

  it('never offers a day before the clock, and keeps the clock day when it is already past the end', () => {
    expect(warpClockDates({ clockDate: WED, endDate: TUE })).toEqual([WED]);
    expect(warpClockDates({ clockDate: '2026-12-10', endDate: TUE })).toEqual(['2026-12-10']);
    expect(warpClockDates({ clockDate: SUN })).toEqual([SUN]);
  });
});

describe('warpExitPath', () => {
  const exit = (current: string) => warpExitPath({ current, copyId: COPY, sourceId: SOURCE, record: RECORD });

  it('stays on the page, on the original tournament', () => {
    expect(exit(`#/tournament/${COPY}/scheduling/2026-11-22/grid`)).toEqual(
      `/tournament/${SOURCE}/scheduling/2026-11-22/grid`,
    );
    expect(exit(`/tournament/${COPY}`)).toEqual(`/tournament/${SOURCE}`);
    expect(exit(`/tournament/${COPY}/event/e1/draw/d1/structure/s1/view/roundsTable`)).toEqual(
      `/tournament/${SOURCE}/event/e1/draw/d1/structure/s1/view/roundsTable`,
    );
  });

  it('steps up from what only the sandbox had', () => {
    expect(exit(`/tournament/${COPY}/event/sandboxEvent/draw/d9`)).toEqual(`/tournament/${SOURCE}/events`);
    expect(exit(`/tournament/${COPY}/event/e1/draw/sandboxDraw/view/roundsTable`)).toEqual(
      `/tournament/${SOURCE}/event/e1`,
    );
    expect(exit(`/tournament/${COPY}/event/e1/draw/d1/structure/sandboxStructure`)).toEqual(
      `/tournament/${SOURCE}/event/e1/draw/d1`,
    );
  });

  it('leaves the choice to the caller when the page is not about the sandbox copy', () => {
    expect(exit('/tournaments')).toBeUndefined();
    expect(exit(`/tournament/${COPY}x/events`)).toBeUndefined();
    expect(warpExitPath({ current: `/tournament/${COPY}`, copyId: COPY })).toBeUndefined();
  });
});

describe('the start of a warp day', () => {
  const court = (startTime: string, date?: string) => ({
    dateAvailability: [{ ...(date ? { date } : {}), startTime }],
  });

  it('opens at the earliest court start on the day, a date of its own before the default', () => {
    expect(dayOpening({ date: SUN, courts: [court('09:00'), court('08:30')] })).toEqual('08:30');
    expect(
      dayOpening({
        date: SUN,
        courts: [{ dateAvailability: [{ startTime: '08:00' }, { date: SUN, startTime: '10:00' }] }],
      }),
    ).toEqual('10:00');
    expect(dayOpening({ date: MON, courts: [court('10:00', SUN)] })).toEqual('08:00');
  });

  it('falls back to the venue default, then 08:00', () => {
    expect(dayOpening({ date: SUN, venues: [{ defaultStartTime: '07:30' }, {}] })).toEqual('07:30');
    expect(dayOpening({ date: SUN })).toEqual('08:00');
  });

  it('leaves an hour of prep before the opening, never before midnight', () => {
    expect(prepTime('08:00')).toEqual('07:00');
    expect(prepTime('08:30')).toEqual('07:30');
    expect(prepTime('00:30')).toEqual('00:00');
  });
});
