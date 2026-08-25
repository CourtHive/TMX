/**
 * The venue time frame.
 *
 * ⚠️ TMX runs vitest with `TZ=UTC` (`package.json`), which is exactly why every
 * assertion here passes an **explicit** zone. A test that relied on the ambient
 * zone would be vacuous: under UTC the browser-zone bug and the venue-zone fix
 * produce identical output, so it could not tell them apart. Each case below
 * names a zone whose offset differs from UTC, which is the only way the
 * difference is observable.
 */
import {
  venueOffsetMinutesAt,
  venueWallClockToMs,
  venueCalendarDate,
  venueDayMinutes,
  venueNowOnDate,
  venueParts,
  venueClock,
} from './venueTimeFrame';
import { describe, expect, it } from 'vitest';

const NEW_YORK = 'America/New_York';
const LOS_ANGELES = 'America/Los_Angeles';
const KOLKATA = 'Asia/Kolkata'; // +05:30 — catches half-hour offsets

const AUG_24 = '2026-08-24';
const AUG_25 = '2026-08-25';
const AUG_25_0900Z = '2026-08-25T09:00:00Z';
const UNPARSEABLE = 'not-a-date';

describe('venueCalendarDate — the day an instant falls on AT THE VENUE', () => {
  it('does not roll the day over at 8pm in Florida, which is the bug that shipped (#1352)', () => {
    // 2026-08-25T00:30:00Z is 20:30 on the 24th in New York.
    expect(venueCalendarDate('2026-08-25T00:30:00Z', NEW_YORK)).toBe(AUG_24);
    // The UTC reading — `toISOString().slice(0, 10)` — would say the 25th.
    expect(new Date('2026-08-25T00:30:00Z').toISOString().slice(0, 10)).toBe('2026-08-25');
  });

  it('rolls the day forward east of UTC, where the same instant is already tomorrow', () => {
    // 18:45Z on the 24th is 00:15 on the 25th in Kolkata.
    expect(venueCalendarDate('2026-08-24T18:45:00Z', KOLKATA)).toBe(AUG_25);
  });

  it('gives different days for one instant in two zones — the whole point', () => {
    const instant = '2026-08-25T03:00:00Z';
    expect(venueCalendarDate(instant, NEW_YORK)).toBe(AUG_24);
    expect(venueCalendarDate(instant, KOLKATA)).toBe(AUG_25);
  });

  it('returns empty for an unparseable value rather than "NaN-NaN-NaN"', () => {
    expect(venueCalendarDate(UNPARSEABLE, NEW_YORK)).toBe('');
  });
});

describe('venueClock / venueDayMinutes — an instant on the venue wall clock', () => {
  it('reads a Florida event three hours apart from a Pacific one', () => {
    const instant = '2026-08-25T19:00:00Z';
    expect(venueClock(instant, NEW_YORK)).toBe('15:00');
    expect(venueClock(instant, LOS_ANGELES)).toBe('12:00');
  });

  it('handles a half-hour zone, which a whole-hour offset model gets wrong', () => {
    expect(venueClock(AUG_25_0900Z, KOLKATA)).toBe('14:30');
    expect(venueDayMinutes(AUG_25_0900Z, KOLKATA)).toBe(14 * 60 + 30);
  });

  it('is undefined, not zero, for an unparseable instant', () => {
    expect(venueDayMinutes(UNPARSEABLE, NEW_YORK)).toBeUndefined();
  });
});

describe('venueOffsetMinutesAt — the offset is a function of WHEN you ask', () => {
  /**
   * The reason the whole module resolves per instant rather than storing a
   * `utcOffsetMinutes`. A fixed offset is the offset at ONE moment, so a
   * tournament spanning a DST change converts an hour wrong on the far side.
   */
  it('differs across the 2026 US spring-forward', () => {
    const before = venueOffsetMinutesAt('2026-03-08T05:00:00Z', NEW_YORK); // 00:00 EST
    const after = venueOffsetMinutesAt('2026-03-08T12:00:00Z', NEW_YORK); // 08:00 EDT
    expect(before).toBe(-300);
    expect(after).toBe(-240);
  });

  it('measures 22:00 → 08:00 across that change as nine hours, not ten', () => {
    const start = venueWallClockToMs('2026-03-07', '22:00', NEW_YORK) as number;
    const end = venueWallClockToMs('2026-03-08', '08:00', NEW_YORK) as number;
    expect((end - start) / 3_600_000).toBe(9);
  });

  it('resolves a half-hour offset exactly', () => {
    expect(venueOffsetMinutesAt(AUG_25_0900Z, KOLKATA)).toBe(330);
  });
});

describe('venueWallClockToMs — a venue wall clock back to an absolute instant', () => {
  it('round-trips against venueClock / venueCalendarDate', () => {
    for (const zone of [NEW_YORK, LOS_ANGELES, KOLKATA]) {
      const ms = venueWallClockToMs(AUG_25, '15:20', zone) as number;
      expect(venueCalendarDate(ms, zone)).toBe(AUG_25);
      expect(venueClock(ms, zone)).toBe('15:20');
    }
  });

  it('is the fix for Call Timing Variance: planned vs actual no longer drifts by the offset', () => {
    // Planned 15:00 at the venue; called at 15:05 venue time.
    const planned = venueWallClockToMs(AUG_25, '15:00', NEW_YORK) as number;
    const called = Date.parse('2026-08-25T19:05:00Z'); // 15:05 in New York
    expect(Math.floor(called / 60000) - Math.floor(planned / 60000)).toBe(5);
  });

  it('is undefined for malformed input rather than a substituted "now"', () => {
    expect(venueWallClockToMs(AUG_25, '99:99', NEW_YORK)).toBeUndefined();
    expect(venueWallClockToMs(UNPARSEABLE, '15:00', NEW_YORK)).toBeUndefined();
    expect(venueWallClockToMs(undefined, '15:00', NEW_YORK)).toBeUndefined();
  });
});

describe('venueNowOnDate — "now" projected onto a viewed date, as a NAIVE Date', () => {
  /**
   * Naivety is load-bearing: this gets compared against court-block bounds,
   * which are zone-less `YYYY-MM-DDTHH:MM:SS` strings parsed the same way. The
   * browser's zone cancels on both sides; only the time-of-day has to be right.
   */
  it('carries the viewed date and the VENUE time-of-day', () => {
    const projected = venueNowOnDate('2026-08-20', KOLKATA);
    const nowParts = venueParts(new Date(), KOLKATA);
    expect(projected.getFullYear()).toBe(2026);
    expect(projected.getMonth()).toBe(7);
    expect(projected.getDate()).toBe(20);
    expect(projected.getHours()).toBe(nowParts?.hour);
    expect(projected.getMinutes()).toBe(nowParts?.minute);
  });

  it('compares correctly against a naive court-block bound in the same frame', () => {
    const projected = venueNowOnDate('2026-08-20', KOLKATA);
    const blockStart = new Date('2026-08-20T00:00:00');
    const blockEnd = new Date('2026-08-21T00:00:00');
    expect(projected >= blockStart).toBe(true);
    expect(projected < blockEnd).toBe(true);
  });
});
