import { localizeReportTimes } from './localizeReportTimes';
import { describe, expect, it } from 'vitest';

const NEW_YORK = 'America/New_York';

// The two venue-local days the production rows below straddle.
const SEP_13 = '2026-09-13';
const SEP_14 = '2026-09-14';

describe('localizeReportTimes', () => {
  it('renders a same-day call as a bare clock in the venue zone', () => {
    const rows: any[] = [{ calledAtIso: '2026-09-13T18:53:52.275Z', scheduledDate: SEP_13, scheduledTime: '14:00' }];
    localizeReportTimes(rows, NEW_YORK);
    expect(rows[0].calledAt).toBe('14:53');
    expect(rows[0].varianceMinutes).toBe(53);
  });

  it('reports a negative variance for a genuine early call on the scheduled day', () => {
    const rows: any[] = [{ calledAtIso: '2026-09-13T17:51:28.902Z', scheduledDate: SEP_13, scheduledTime: '14:00' }];
    localizeReportTimes(rows, NEW_YORK);
    expect(rows[0].calledAt).toBe('13:51');
    expect(rows[0].varianceMinutes).toBe(-9);
  });

  /**
   * The production regression, with the real values from the four Men's Singles
   * quarterfinals of `a4e439fa-…` — called on the afternoon of 2026-09-13, then
   * re-dated to 2026-09-14 08:00 with their court and venue removed. They read
   * −1009 and −1026 minutes.
   */
  it('floors a call made on an earlier venue day to 0 rather than ~-17 hours', () => {
    const rows: any[] = [
      { calledAtIso: '2026-09-13T19:11:06.286Z', scheduledDate: SEP_14, scheduledTime: '08:00' },
      { calledAtIso: '2026-09-13T18:54:53.079Z', scheduledDate: SEP_14, scheduledTime: '08:00' },
    ];
    localizeReportTimes(rows, NEW_YORK);
    expect(rows.map((row) => row.varianceMinutes)).toEqual([0, 0]);
  });

  it('date-prefixes the displayed clock when the call landed on another venue day', () => {
    const rows: any[] = [{ calledAtIso: '2026-09-13T19:11:06.286Z', scheduledDate: SEP_14, scheduledTime: '08:00' }];
    localizeReportTimes(rows, NEW_YORK);
    expect(rows[0].calledAt).toBe(`${SEP_13} 15:11`);
  });

  /**
   * The floor is a claim about pre-staging, not about magnitude. A call made
   * LATER than the scheduled day is a late call and keeps its (large) positive
   * variance — flooring that would hide a day-long overrun.
   */
  it('leaves a call made on a LATER venue day at its full positive variance', () => {
    const rows: any[] = [{ calledAtIso: '2026-09-14T12:00:00.000Z', scheduledDate: SEP_13, scheduledTime: '08:00' }];
    localizeReportTimes(rows, NEW_YORK);
    expect(rows[0].calledAt).toBe(`${SEP_14} 08:00`);
    expect(rows[0].varianceMinutes).toBe(1440);
  });

  it('resolves the planned instant in the venue zone, not the operator zone', () => {
    // 14:00 New York on 2026-09-13 is 18:00Z (EDT, UTC-4). A call at 18:00Z is
    // exactly on time; reading 14:00 as a UTC wall clock would report +240.
    const rows: any[] = [{ calledAtIso: '2026-09-13T18:00:00.000Z', scheduledDate: SEP_13, scheduledTime: '14:00' }];
    localizeReportTimes(rows, NEW_YORK);
    expect(rows[0].varianceMinutes).toBe(0);
  });

  it('leaves rows without a calledAtIso untouched', () => {
    const rows: any[] = [{ scheduledDate: SEP_13, scheduledTime: '14:00', varianceMinutes: 7 }];
    localizeReportTimes(rows, NEW_YORK);
    expect(rows[0]).toEqual({ scheduledDate: SEP_13, scheduledTime: '14:00', varianceMinutes: 7 });
  });

  it('localizes the clock but leaves the variance alone when there is no planned time', () => {
    const rows: any[] = [{ calledAtIso: '2026-09-13T18:53:52.275Z', scheduledDate: SEP_13 }];
    localizeReportTimes(rows, NEW_YORK);
    expect(rows[0].calledAt).toBe('14:53');
    expect(rows[0].varianceMinutes).toBeUndefined();
  });

  it('tolerates an undefined rows argument', () => {
    expect(() => localizeReportTimes(undefined as any, NEW_YORK)).not.toThrow();
  });
});
