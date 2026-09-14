import {
  addBookingsToDateAvailability,
  openWindowFor,
  roundUpToQuarter,
  timeBlockError,
  toClock,
  usableRows,
} from './timeBlockLogic';
import { describe, expect, it } from 'vitest';

// constants and types
import type { TimeBlockRow } from './timeBlockLogic';

const DATE = '2026-09-13';
const OTHER = '2026-09-14';
const row = (over: Partial<TimeBlockRow> = {}): TimeBlockRow => ({
  startTime: '14:30',
  endTime: '16:00',
  bookingType: 'MAINTENANCE',
  ...over,
});

describe('timeBlockError', () => {
  it('reports nothing to save when no row has been filled in', () => {
    expect(timeBlockError([row({ startTime: '', endTime: '' })])).toBe('none');
  });

  it('reports an incomplete row — one time without the other', () => {
    expect(timeBlockError([row({ endTime: '' })])).toBe('incomplete');
    expect(timeBlockError([row({ startTime: '' })])).toBe('incomplete');
  });

  it('reports an end at or before its start', () => {
    // Not a midnight-crossing period: the record is per DATE, so there is no
    // next day to cross into.
    expect(timeBlockError([row({ startTime: '16:00', endTime: '14:30' })])).toBe('inverted');
    expect(timeBlockError([row({ startTime: '16:00', endTime: '16:00' })])).toBe('inverted');
  });

  it('rejects a value that is not a clock at all', () => {
    expect(timeBlockError([row({ startTime: '25:00' })])).toBe('inverted');
    expect(timeBlockError([row({ endTime: '14:99' })])).toBe('inverted');
  });

  it('accepts well-formed rows, and ignores an untouched one beside them', () => {
    expect(timeBlockError([row(), row({ startTime: '', endTime: '' })])).toBeUndefined();
  });
});

describe('usableRows', () => {
  it('keeps only rows with both times', () => {
    expect(usableRows([row(), row({ endTime: '' }), row({ startTime: '', endTime: '' })])).toHaveLength(1);
  });
});

describe('openWindowFor — a new date needs the court open hours, not just bookings', () => {
  it('prefers the entry for the date itself', () => {
    const existing = [
      { startTime: '07:00', endTime: '19:00' },
      { date: DATE, startTime: '08:00', endTime: '20:00' },
    ];
    expect(openWindowFor(existing, DATE)).toEqual({ startTime: '08:00', endTime: '20:00' });
  });

  it("falls back to the court's date-less default — the statement of when it is open on any day", () => {
    expect(openWindowFor([{ startTime: '07:00', endTime: '19:00' }], DATE)).toEqual({
      startTime: '07:00',
      endTime: '19:00',
    });
  });

  it('falls back to another dated entry rather than inventing hours', () => {
    expect(openWindowFor([{ date: OTHER, startTime: '09:00', endTime: '17:00' }], DATE)).toEqual({
      startTime: '09:00',
      endTime: '17:00',
    });
  });

  it('reports that there is no window rather than guessing one', () => {
    // A guess would silently change when a court is open, which is a bigger
    // claim than the operator made by blocking an hour of it.
    expect(openWindowFor([], DATE)).toBeUndefined();
    expect(openWindowFor([{ date: DATE }], DATE)).toBeUndefined();
  });
});

describe('addBookingsToDateAvailability', () => {
  it('appends to the existing entry for the date, keeping its other fields', () => {
    const existing = [
      {
        date: DATE,
        startTime: '08:00',
        endTime: '20:00',
        bookings: [{ startTime: '09:00', endTime: '10:00' }],
        notes: 'n',
      },
    ];
    const result = addBookingsToDateAvailability(existing, DATE, [row()]);

    expect(result).toHaveLength(1);
    expect(result?.[0].bookings).toHaveLength(2);
    expect(result?.[0].notes).toEqual('n');
    expect(result?.[0].bookings[1]).toEqual({ startTime: '14:30', endTime: '16:00', bookingType: 'MAINTENANCE' });
  });

  it('creates the entry when the date has none, borrowing the open window', () => {
    const result = addBookingsToDateAvailability([{ startTime: '07:00', endTime: '19:00' }], DATE, [row()]);

    expect(result).toHaveLength(2);
    expect(result?.[1]).toEqual({
      date: DATE,
      startTime: '07:00',
      endTime: '19:00',
      bookings: [{ startTime: '14:30', endTime: '16:00', bookingType: 'MAINTENANCE' }],
    });
  });

  it('leaves a date-less default entry untouched', () => {
    // The entry the factory used to corrupt into `date: "undefined"` on the way
    // past — see #4866(factory). Nothing here may disturb it either.
    const dateless = { startTime: '07:00', endTime: '19:00' };
    const result = addBookingsToDateAvailability([dateless], DATE, [row()]);
    expect(result?.[0]).toEqual(dateless);
    expect(result?.some((entry) => entry.date === 'undefined')).toBe(false);
  });

  it('leaves other dates alone', () => {
    const other = { date: OTHER, startTime: '09:00', endTime: '17:00' };
    const result = addBookingsToDateAvailability([other, { date: DATE, startTime: '08:00', endTime: '20:00' }], DATE, [
      row(),
    ]);
    expect(result?.[0]).toEqual(other);
  });

  it('writes every filled row as its own booking', () => {
    const rows = [row(), row({ startTime: '18:00', endTime: '19:00', bookingType: 'PRACTICE' })];
    const result = addBookingsToDateAvailability([{ date: DATE, startTime: '08:00', endTime: '20:00' }], DATE, rows);
    expect(result?.[0].bookings).toHaveLength(2);
    expect(result?.[0].bookings[1].bookingType).toEqual('PRACTICE');
  });

  it('declines when there is nothing to write', () => {
    expect(addBookingsToDateAvailability([], DATE, [row({ startTime: '', endTime: '' })])).toBeUndefined();
  });

  it('declines when the court has no open window to hang the block on', () => {
    expect(addBookingsToDateAvailability([], DATE, [row()])).toBeUndefined();
  });

  it('does not mutate the input', () => {
    const existing = [{ date: DATE, startTime: '08:00', endTime: '20:00', bookings: [] as any[] }];
    addBookingsToDateAvailability(existing, DATE, [row()]);
    expect(existing[0].bookings).toHaveLength(0);
  });
});

describe('the modal defaults', () => {
  it('rounds up to the availability grid own quarter-hour granularity', () => {
    expect(roundUpToQuarter(14 * 60 + 7)).toBe(14 * 60 + 15);
    expect(roundUpToQuarter(14 * 60 + 15)).toBe(14 * 60 + 15);
  });

  it('never rounds past the end of the day', () => {
    expect(toClock(roundUpToQuarter(23 * 60 + 58))).toBe('23:45');
  });

  it('formats minutes as a clock a native time input accepts', () => {
    expect(toClock(9 * 60 + 5)).toBe('09:05');
    expect(toClock(0)).toBe('00:00');
  });
});
