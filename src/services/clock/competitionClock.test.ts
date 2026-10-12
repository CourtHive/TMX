import { competitionNow, competitionNowMs, onCompetitionClockChange, setCompetitionClock } from './competitionClock';
import { venueNowClock, venueNowOnDate, venueToday } from 'functions/venueTimeFrame';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Slice 0-d.3: TMX's scheduling "now" goes through one seam, so a demo can move it as a whole.
// Every zone below is explicit; the suite runs TZ=UTC.
const TOKYO = 'Asia/Tokyo';
const INSTANT = Date.parse('2026-05-17T15:30:00.000Z'); // 00:30 on the 18th in Tokyo
const TOKYO_DAY = '2026-05-18';

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

  // Rewritten 2026-10-13 with CA's approval: this test pinned a fallback to the device clock, which a
  // third-party review showed breaks a simulation (decisions and stamps jump to today). It now pins
  // the refusal that replaced it.
  it.each([Number.NaN, Number.POSITIVE_INFINITY, 1e20])(
    'gives no instant for %s, never the device clock, and says so once',
    (bad) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      setCompetitionClock({ nowMs: () => bad });
      expect(competitionNowMs()).toBeUndefined();
      expect(Number.isNaN(competitionNow().getTime())).toBe(true);
      // every venue reading of "now" comes back empty rather than as today
      expect(venueToday(TOKYO)).toBe('');
      expect(venueNowClock(TOKYO)).toBe('');
      expect(venueNowOnDate(TOKYO_DAY, TOKYO)).toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);
    },
  );

  it("moves the venue's today, clock and Now-strip instant together", () => {
    setCompetitionClock({ nowMs: () => INSTANT });
    expect(venueToday(TOKYO)).toBe(TOKYO_DAY);
    expect(venueNowClock(TOKYO)).toBe('00:30');
    expect(venueNowOnDate(TOKYO_DAY, TOKYO)?.getHours()).toBe(0);
    // the 19th is still ahead of the venue, so it has no "now"
    expect(venueNowOnDate('2026-05-19', TOKYO)).toBeUndefined();
  });
});

describe('competitionClock change notification', () => {
  // A change made by an earlier test's teardown leaves a frame pending on the real timers; let it fire,
  // or this test's changes coalesce into a frame the fake timers never see.
  beforeEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  afterEach(() => {
    setCompetitionClock();
    vi.useRealTimers();
  });

  it('coalesces any number of changes before the next frame into ONE call', () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const dispose = onCompetitionClockChange(listener);
    for (let step = 0; step < 100; step++) setCompetitionClock({ nowMs: () => INSTANT + step * 60_000 });
    expect(listener).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('calls a disposed listener zero times, even with a change already pending', () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const dispose = onCompetitionClockChange(listener);
    setCompetitionClock({ nowMs: () => INSTANT });
    dispose();
    vi.runAllTimers();
    setCompetitionClock();
    vi.runAllTimers();
    expect(listener).not.toHaveBeenCalled();
  });
});
