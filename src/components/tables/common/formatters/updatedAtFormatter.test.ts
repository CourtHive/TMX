import { describe, expect, it } from 'vitest';
import { formatUpdatedAt, updatedAtFormatter } from './updatedAtFormatter';

/**
 * The test suite runs with TZ=UTC (see TMX `package.json` scripts), so
 * local `getHours()` / `getDate()` / … are stable — UTC midnight on
 * `2026-04-16` stays `2026-04-16 00:00` rather than sliding into the
 * prior or next day for off-UTC runners. Production rendering uses the
 * user's actual local timezone, which is what the scorekeeper wants.
 */

const SAMPLE_ISO = '2026-04-16T14:32:05Z';
const SAMPLE_DISPLAY = '2026-04-16 14:32';

describe('formatUpdatedAt', () => {
  it('renders a standard ISO UTC string as YYYY-MM-DD HH:MM', () => {
    expect(formatUpdatedAt('2026-04-16T14:32:05.000Z')).toBe(SAMPLE_DISPLAY);
  });

  it('trims seconds and milliseconds from the output', () => {
    // The stamp's ms precision belongs in the tooltip, not the cell
    // body. Minute resolution is the right grain for a table audit
    // column.
    expect(formatUpdatedAt('2026-04-16T14:32:59.999Z')).toBe(SAMPLE_DISPLAY);
  });

  it('zero-pads month, day, hour, and minute', () => {
    expect(formatUpdatedAt('2026-01-02T03:04:05Z')).toBe('2026-01-02 03:04');
  });

  it('returns an empty string for undefined / null / empty', () => {
    expect(formatUpdatedAt(undefined)).toBe('');
    expect(formatUpdatedAt(null)).toBe('');
    expect(formatUpdatedAt('')).toBe('');
  });

  it('returns an empty string for unparseable input (no throw)', () => {
    expect(formatUpdatedAt('not-a-date')).toBe('');
    expect(formatUpdatedAt('2026-13-45T99:99:99Z')).toBe('');
    // Plain objects coerce to `Invalid Date`.
    expect(formatUpdatedAt({})).toBe('');
    // Bare arrays also coerce to Invalid Date.
    expect(formatUpdatedAt([])).toBe('');
  });

  it('accepts a Date instance directly (defensive input tolerance)', () => {
    expect(formatUpdatedAt(new Date(SAMPLE_ISO))).toBe(SAMPLE_DISPLAY);
  });

  it('accepts a numeric epoch millisecond value', () => {
    const ms = Date.UTC(2026, 3, 16, 14, 32, 5); // April is month index 3
    expect(formatUpdatedAt(ms)).toBe(SAMPLE_DISPLAY);
  });
});

describe('updatedAtFormatter (Tabulator cell wrapper)', () => {
  function makeCell(value: unknown) {
    const element = {
      setAttribute: (_k: string, _v: string) => {},
    } as HTMLElement & { setAttribute: (k: string, v: string) => void };
    return {
      getValue: () => value,
      getElement: () => element,
      element,
    };
  }

  it('returns the formatted display string for a valid ISO', () => {
    expect(updatedAtFormatter(makeCell(SAMPLE_ISO))).toBe(SAMPLE_DISPLAY);
  });

  it('returns an empty string and does not set a title for empty input', () => {
    let titleWrites = 0;
    const cell = makeCell('');
    cell.getElement().setAttribute = () => {
      titleWrites += 1;
    };
    expect(updatedAtFormatter(cell)).toBe('');
    expect(titleWrites).toBe(0);
  });

  it('sets the raw ISO as the cell title tooltip for recoverability', () => {
    const titleWrites: Array<[string, string]> = [];
    const cell = makeCell(SAMPLE_ISO);
    cell.getElement().setAttribute = (k: string, v: string) => {
      titleWrites.push([k, v]);
    };
    updatedAtFormatter(cell);
    expect(titleWrites).toContainEqual(['title', SAMPLE_ISO]);
  });

  it('tolerates a missing element (no throw)', () => {
    const cell = {
      getValue: () => SAMPLE_ISO,
      getElement: () => undefined,
    };
    expect(() => updatedAtFormatter(cell)).not.toThrow();
    expect(updatedAtFormatter(cell)).toBe(SAMPLE_DISPLAY);
  });
});
