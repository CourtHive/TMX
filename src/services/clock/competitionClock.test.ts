import { venueNowClock, venueNowOnDate, venueToday } from 'functions/venueTimeFrame';
import { competitionNow, setCompetitionClock } from './competitionClock';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Slice 0-d.3: TMX's scheduling "now" goes through one seam, so a demo can move it as a whole.
// Every zone below is explicit; the suite runs TZ=UTC.
const TOKYO = 'Asia/Tokyo';
const INSTANT = Date.parse('2026-05-17T15:30:00.000Z'); // 00:30 on the 18th in Tokyo

describe('competitionClock', () => {
  afterEach(() => {
    setCompetitionClock();
    vi.restoreAllMocks();
  });

  it('is the device clock when nothing is installed', () => {
    const before = Date.now();
    const now = competitionNow().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now - before).toBeLessThan(5_000);
  });

  it('follows an installed clock, and stops when it is removed', () => {
    expect(setCompetitionClock({ nowMs: () => INSTANT }).success).toBe(true);
    expect(competitionNow().getTime()).toBe(INSTANT);
    setCompetitionClock();
    expect(Math.abs(competitionNow().getTime() - Date.now())).toBeLessThan(5_000);
  });

  it('refuses junk at install', () => {
    expect(setCompetitionClock({} as any).error).toBe('INVALID_VALUES');
  });

  it('falls back to the device clock for a non-finite answer, and says so once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    setCompetitionClock({ nowMs: () => Number.NaN });
    competitionNow();
    const fallback = competitionNow().getTime();
    expect(Math.abs(fallback - Date.now())).toBeLessThan(5_000);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("moves the venue's today, clock and Now-strip instant together", () => {
    setCompetitionClock({ nowMs: () => INSTANT });
    expect(venueToday(TOKYO)).toBe('2026-05-18');
    expect(venueNowClock(TOKYO)).toBe('00:30');
    expect(venueNowOnDate('2026-05-18', TOKYO)?.getHours()).toBe(0);
    // the 19th is still ahead of the venue, so it has no "now"
    expect(venueNowOnDate('2026-05-19', TOKYO)).toBeUndefined();
  });
});
