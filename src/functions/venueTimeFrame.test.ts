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
  resolveVenueFrame,
  venueLocaleString,
  venueOffsetMinutesAt,
  venueWallClockToMs,
  venueCalendarDate,
  venueDayMinutes,
  venueNowOnDate,
  venueNowClock,
  venueTimeZone,
  venueToday,
  venueParts,
  venueClock,
} from './venueTimeFrame';
import { factoryConstants, mocksEngine } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
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
   * A day that is already past at the venue, so the projection applies. Fixed
   * rather than computed: a relative date would drift into "today" or "future"
   * depending on when the suite runs, and those are different rules below.
   */
  const PAST_DAY = '2026-08-20';

  /**
   * Naivety is load-bearing: this gets compared against court-block bounds,
   * which are zone-less `YYYY-MM-DDTHH:MM:SS` strings parsed the same way. The
   * browser's zone cancels on both sides; only the time-of-day has to be right.
   */
  it('carries the viewed date and the VENUE time-of-day', () => {
    const projected = venueNowOnDate(PAST_DAY, KOLKATA) as Date;
    const nowParts = venueParts(new Date(), KOLKATA);
    expect(projected).toBeInstanceOf(Date);
    expect(projected.getFullYear()).toBe(2026);
    expect(projected.getMonth()).toBe(7);
    expect(projected.getDate()).toBe(20);
    expect(projected.getHours()).toBe(nowParts?.hour);
    expect(projected.getMinutes()).toBe(nowParts?.minute);
  });

  it('compares correctly against a naive court-block bound in the same frame', () => {
    const projected = venueNowOnDate(PAST_DAY, KOLKATA) as Date;
    const blockStart = new Date('2026-08-20T00:00:00');
    const blockEnd = new Date('2026-08-21T00:00:00');
    expect(projected >= blockStart).toBe(true);
    expect(projected < blockEnd).toBe(true);
  });
});

/**
 * The projection runs backwards in time only. Onto a future day it would not
 * describe a clock but invent one, marking every block painted before the
 * current time-of-day as in effect on a day nobody has reached — which is the
 * court-block twin of the rest badge that read "on court" in a tournament with
 * no courts.
 *
 * Dated off the venue's own today rather than a literal, because "future" is
 * the one property a fixed date cannot keep.
 */
describe('venueNowOnDate — a day the venue has not reached has no "now"', () => {
  /** `YYYY-MM-DD`, `offset` days from the venue's today. Parsed as UTC, so no DST can shorten a day. */
  function venueDayOffsetBy(offset: number, timeZone: string): string {
    const today = venueCalendarDate(new Date(), timeZone);
    const shifted = new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86_400_000);
    return shifted.toISOString().slice(0, 10);
  }

  it('returns undefined for tomorrow, and for any day beyond it', () => {
    expect(venueNowOnDate(venueDayOffsetBy(1, KOLKATA), KOLKATA)).toBeUndefined();
    expect(venueNowOnDate(venueDayOffsetBy(30, KOLKATA), KOLKATA)).toBeUndefined();
  });

  it('still answers for today and for yesterday', () => {
    expect(venueNowOnDate(venueDayOffsetBy(0, KOLKATA), KOLKATA)).toBeInstanceOf(Date);
    expect(venueNowOnDate(venueDayOffsetBy(-1, KOLKATA), KOLKATA)).toBeInstanceOf(Date);
  });

  /**
   * The boundary is the VENUE's day, not the operator's. Under `TZ=UTC` the
   * runner and Kolkata disagree about the date for five and a half hours every
   * night; asking about the venue's own today must be answerable throughout.
   */
  it('reads the boundary against the venue day rather than the runner day', () => {
    expect(venueNowOnDate(venueDayOffsetBy(0, KOLKATA), KOLKATA)).toBeInstanceOf(Date);
    expect(venueNowOnDate(venueDayOffsetBy(0, LOS_ANGELES), LOS_ANGELES)).toBeInstanceOf(Date);
  });

  it('takes the same exit for a date it cannot read', () => {
    expect(venueNowOnDate(UNPARSEABLE, KOLKATA)).toBeUndefined();
  });
});

/**
 * The A10 footgun, closed.
 *
 * `venueClock()` / `venueCalendarDate()` / `venueDayMinutes()` used to
 * substitute `new Date()` for a missing instant, which put the CURRENT clock in
 * the Called column of every matchUp that had never been called (#1387). The
 * argument is now required, so that mistake is a type error — and the two sites
 * that genuinely mean "now" ask for it by name.
 *
 * A required argument cannot be tested by calling without one (it would not
 * compile, which is the point), so what is asserted here is the pair of named
 * helpers and the fact that an UNREADABLE instant still yields a missing value
 * rather than a substituted one — the same failure mode arriving by a different
 * door, and the one the compiler cannot close.
 */
describe('"now" is asked for by name, and a bad instant is never quietly replaced', () => {
  it('venueToday agrees with venueCalendarDate on the current instant', () => {
    expect(venueToday(KOLKATA)).toBe(venueCalendarDate(new Date(), KOLKATA));
  });

  it('venueNowClock agrees with venueClock on the current instant', () => {
    // Both read the same clock a moment apart, so compare the hour rather than
    // the minute-precise string, which can tick between the two calls.
    expect(venueNowClock(KOLKATA).slice(0, 2)).toBe(venueClock(new Date(), KOLKATA).slice(0, 2));
  });

  it('reads "now" against the VENUE zone, not the runner zone', () => {
    // Under TZ=UTC these differ for five and a half hours of every day, which is
    // the only thing that makes this assertion worth writing.
    expect(venueNowClock(KOLKATA)).not.toBe(venueNowClock('UTC'));
  });

  it.each([[UNPARSEABLE], ['']])('returns empty for the unreadable instant %o rather than now', (value) => {
    expect(venueCalendarDate(value, KOLKATA)).toBe('');
    expect(venueClock(value, KOLKATA)).toBe('');
    expect(venueDayMinutes(value, KOLKATA)).toBeUndefined();
  });
});

describe('resolveVenueFrame — which zone, and whether the page may say it is sure', () => {
  /**
   * The one function no site may re-implement. Everything else in this module
   * takes a zone; this decides WHICH zone, and the `source` it returns is what
   * the schedule's notice branches on. A regression here is silent by
   * construction — the times still render, they are just framed wrong — so it is
   * worth the engine setup a value test needs.
   */
  const seed = (localTimeZone?: string) => {
    mocksEngine.generateTournamentRecord({ drawProfiles: [{ drawSize: 2 }], setState: true });
    if (localTimeZone) tournamentEngine.setTournamentLocalTimeZone({ localTimeZone });
  };

  it("takes the tournament's zone when the record carries one, and says so", () => {
    seed(KOLKATA);
    expect(resolveVenueFrame()).toEqual({ timeZone: KOLKATA, source: 'tournament' });
    expect(venueTimeZone()).toBe(KOLKATA);
  });

  it('falls back to the device zone when the record carries none — and reports the fallback', () => {
    seed();
    const frame = resolveVenueFrame();
    // The suite runs TZ=UTC, so the device zone is UTC here; `source` is the
    // assertion that matters, because it is what puts the notice on screen.
    expect(frame.source).toBe('browser');
    expect(frame.timeZone).toBeTruthy();
  });

  it('re-reads the record, so setting a zone re-frames the page without a reload', () => {
    seed();
    expect(resolveVenueFrame().source).toBe('browser');
    tournamentEngine.setTournamentLocalTimeZone({ localTimeZone: NEW_YORK });
    expect(resolveVenueFrame()).toEqual({ timeZone: NEW_YORK, source: 'tournament' });
  });

  it('always yields a usable zone, so no caller has to handle an absent one', () => {
    seed();
    expect(() => venueClock(new Date(), venueTimeZone())).not.toThrow();
    expect(venueCalendarDate('2026-08-25T12:00:00Z', venueTimeZone())).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("the arithmetic is the factory's, and the deltas that moved with it", () => {
  // venueWallClockToMs / venueOffsetMinutesAt / venueParts now call
  // tools.zonedDateTime rather than a local port. Equivalence was swept before
  // the swap — 8 zones x 365 days x 4 instants for parts and offsets, and
  // x 5 wall clocks for conversions, with zero disagreements. What follows is
  // the handful of inputs where behaviour deliberately CHANGED.

  it('refuses an out-of-range date instead of rolling it into the next month', () => {
    // Previously '2026-13-01' silently became 2027-01-01, and '2026-02-30'
    // became March 2nd — a plausible wrong instant, which is the failure mode
    // this whole module exists to eliminate. No caller passes these; no test
    // covered them.
    expect(venueWallClockToMs('2026-13-01', '09:00', NEW_YORK)).toBeUndefined();
    expect(venueWallClockToMs('2026-02-30', '09:00', NEW_YORK)).toBeUndefined();
  });

  it('accepts an unpadded date rather than dropping it', () => {
    expect(venueWallClockToMs('2026-6-1', '09:00', NEW_YORK)).toEqual(
      venueWallClockToMs('2026-06-01', '09:00', NEW_YORK),
    );
  });

  it('requires a bare calendar day, not an instant, as the wall-clock date', () => {
    // The old prefix-matching regex accepted a trailing time and ignored it,
    // which quietly let an instant be passed where a naive day was meant — the
    // exact confusion this module is built around.
    expect(venueWallClockToMs('2026-08-25T00:00', '09:00', NEW_YORK)).toBeUndefined();
  });

  it('still resolves midnight to hour 0', () => {
    // The formatToParts read this replaced needed a guard for engines that
    // report midnight as hour '24'. Arithmetic on the instant cannot produce a
    // 24th hour, so the guard is gone — this proves it was not load-bearing.
    const midnight = venueWallClockToMs(AUG_25, '00:00', NEW_YORK) as number;
    expect(venueParts(midnight, NEW_YORK)?.hour).toBe(0);
    expect(venueClock(midnight, NEW_YORK)).toBe('00:00');
  });
});

describe("the frame is the factory's: inferred venue zones, and refusals that stay refusals", () => {
  /**
   * Slice 0-a of Mentat/planning/COMPETITION_CLOCK_INSTRUMENTATION.md. `resolveVenueFrame` used to read
   * `localTimeZone` alone and fall to the browser for everything else, and every helper sent an OMITTED zone
   * to the browser too. The suite's TZ=UTC is the browser here, so each case names a zone that is not UTC.
   */
  const { CONFLICTING_TIME_ZONES, INVALID_TIME_ZONE } = factoryConstants.errorConditionConstants;
  const TOKYO = 'Asia/Tokyo'; // +09:00, no DST
  const NOT_A_ZONE = 'Mars/Olympus_Mons';
  // 00:30 on Aug 25 in Tokyo, still Aug 24 in UTC: a day boundary only the venue zone gets right.
  const TOKYO_AFTER_MIDNIGHT = '2026-08-24T15:30:00Z';

  const seed = ({ localTimeZone, venueZones = [] }: { localTimeZone?: string; venueZones?: string[] }) => {
    const { tournamentRecord } = mocksEngine.generateTournamentRecord({ drawProfiles: [{ drawSize: 2 }] });
    tournamentRecord.venues = venueZones.map((timeZone, index) => ({
      venueId: `venue-${index}`,
      venueName: `Venue ${index}`,
      addresses: [{ timeZone }],
    }));
    // set on the record directly: the factory's own setter refuses an invalid zone, and this has to hold one
    if (localTimeZone) tournamentRecord.localTimeZone = localTimeZone;
    tournamentEngine.setState(tournamentRecord);
  };

  it('a tournament zone wins even where its venues disagree with it', () => {
    seed({ localTimeZone: TOKYO, venueZones: [NEW_YORK, LOS_ANGELES] });
    expect(resolveVenueFrame()).toEqual({ timeZone: TOKYO, source: 'tournament' });
  });

  it('with no tournament zone, venues that agree name it, and say it was inferred', () => {
    seed({ venueZones: [TOKYO, TOKYO] });
    expect(resolveVenueFrame()).toEqual({ timeZone: TOKYO, source: 'venue' });
  });

  it('venues that disagree, with nothing to settle them, refuse the frame', () => {
    seed({ venueZones: [NEW_YORK, LOS_ANGELES] });
    const frame = resolveVenueFrame();
    expect(frame.source).toBe('error');
    expect(frame.error?.code).toBe(CONFLICTING_TIME_ZONES.code);
    expect(frame.timeZone).toBeUndefined();
  });

  it('an invalid tournament zone refuses, though every venue names a valid one', () => {
    seed({ localTimeZone: NOT_A_ZONE, venueZones: [TOKYO] });
    const frame = resolveVenueFrame();
    expect(frame.source).toBe('error');
    expect(frame.error?.code).toBe(INVALID_TIME_ZONE.code);
  });

  it('no zone anywhere is still the browser case, and only that is', () => {
    seed({});
    expect(resolveVenueFrame().source).toBe('browser');
  });

  it("an OMITTED zone reads the tournament's frame, not the browser's", () => {
    seed({ localTimeZone: TOKYO });
    expect(venueClock(TOKYO_AFTER_MIDNIGHT)).toBe('00:30');
    expect(venueCalendarDate(TOKYO_AFTER_MIDNIGHT)).toBe(AUG_25);
    expect(venueDayMinutes(TOKYO_AFTER_MIDNIGHT)).toBe(30);
    expect(venueWallClockToMs(AUG_25, '00:30')).toBe(Date.parse(TOKYO_AFTER_MIDNIGHT));
  });

  it('an omitted zone resolves its offset per instant, across DST, in an inferred frame too', () => {
    seed({ venueZones: [NEW_YORK] });
    expect(venueOffsetMinutesAt('2026-03-08T06:00:00Z')).toBe(-300);
    expect(venueOffsetMinutesAt('2026-03-08T08:00:00Z')).toBe(-240);
  });

  it('a SUPPLIED invalid zone refuses, rather than falling back to any other zone', () => {
    seed({ localTimeZone: TOKYO });
    expect(venueClock(TOKYO_AFTER_MIDNIGHT, NOT_A_ZONE)).toBe('');
    expect(venueCalendarDate(TOKYO_AFTER_MIDNIGHT, '')).toBe('');
    expect(venueWallClockToMs(AUG_25, '00:30', NOT_A_ZONE)).toBeUndefined();
    expect(venueOffsetMinutesAt(TOKYO_AFTER_MIDNIGHT, NOT_A_ZONE)).toBeUndefined();
  });

  it('a missing calledAt is still missing, never "now", in any frame', () => {
    seed({ localTimeZone: TOKYO });
    expect(venueClock(undefined as any)).toBe('');
    expect(venueCalendarDate(undefined as any)).toBe('');
  });

  describe('under a refused frame, every conversion comes back empty', () => {
    const refused = () => seed({ venueZones: [NEW_YORK, LOS_ANGELES] });

    it('instants, days, offsets and wall clocks', () => {
      refused();
      expect(venueTimeZone()).toBeUndefined();
      expect(venueClock(AUG_25_0900Z)).toBe('');
      expect(venueCalendarDate(AUG_25_0900Z)).toBe('');
      expect(venueDayMinutes(AUG_25_0900Z)).toBeUndefined();
      expect(venueParts(AUG_25_0900Z)).toBeUndefined();
      expect(venueOffsetMinutesAt(AUG_25_0900Z)).toBeUndefined();
      // handed no zone, the factory would answer this on a fixed UTC offset
      expect(venueWallClockToMs(AUG_25, '09:00')).toBeUndefined();
    });

    it('"now" by name: no today, no clock', () => {
      refused();
      expect(venueToday()).toBe('');
      expect(venueNowClock()).toBe('');
    });

    it('venueNowOnDate has no now on ANY day, rather than inventing midnight', () => {
      refused();
      expect(venueNowOnDate(AUG_24)).toBeUndefined();
      expect(venueNowOnDate('2020-01-01')).toBeUndefined();
    });

    it('venueLocaleString is empty, where toLocaleString would have used the browser zone', () => {
      refused();
      expect(venueLocaleString(AUG_25_0900Z)).toBe('');
      seed({ localTimeZone: TOKYO });
      expect(venueLocaleString(AUG_25_0900Z, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, 'time')).toBe(
        '18:00',
      );
    });
  });
});
