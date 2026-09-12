/**
 * ⚠️ The assertions that matter here are the ones run under a zone EAST of UTC.
 *
 * `pnpm test` pins `TZ=UTC`, and every developer machine in this ecosystem sits
 * at UTC or west of it. The defect this function exists to end — local-midnight
 * in, UTC-day out — is *invisible* in all of those: at UTC-4 a local midnight
 * round-trips through UTC to the same calendar day. So a suite that only ever
 * runs west of Greenwich is structurally incapable of expressing it, which is
 * exactly how it survived in two files for as long as it did.
 *
 * Rather than ask CI for a second TZ leg, the zone is applied per-assertion:
 * `withTimeZone` sets `process.env.TZ`, which V8 honours for `Date` from the
 * next construction onward. The zone therefore travels with the test rather
 * than with the runner, and the east-of-UTC case cannot be lost by someone
 * reconfiguring a workflow.
 */
import { plainDateRange } from './plainDateRange';
import { afterEach, describe, expect, it } from 'vitest';

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

/** Run `fn` with the process clock reading `timeZone`. */
function withTimeZone<T>(timeZone: string, fn: () => T): T {
  process.env.TZ = timeZone;
  return fn();
}

const FIRST_DAY = '2026-09-12';
const LAST_DAY = '2026-09-15';
const SEPT = [FIRST_DAY, '2026-09-13', '2026-09-14', LAST_DAY];
const AUCKLAND = 'Pacific/Auckland';
const NEW_YORK = 'America/New_York';

describe('plainDateRange — the same days in every zone', () => {
  /**
   * Auckland (+12/+13) and Berlin (+1/+2) are the cases the old walk got wrong,
   * both by exactly one day: it offered the day BEFORE the tournament started
   * and never offered its last day. UTC and New York are the cases that always
   * passed, and they are here to prove the fix did not simply move the error.
   */
  it.each(['UTC', NEW_YORK, 'Europe/Berlin', AUCKLAND])('walks 2026-09-12..15 identically under %s', (timeZone) => {
    expect(withTimeZone(timeZone, () => plainDateRange(FIRST_DAY, LAST_DAY))).toEqual(SEPT);
  });

  it('starts on startDate and ends on endDate, east of UTC', () => {
    // Stated separately from the equality above because these two are the
    // operator-visible symptoms: a date chip for a day before play, and a
    // missing chip for the final day.
    const dates = withTimeZone(AUCKLAND, () => plainDateRange(FIRST_DAY, LAST_DAY));
    expect(dates.at(0)).toBe(FIRST_DAY);
    expect(dates.at(-1)).toBe(LAST_DAY);
  });

  it('crosses a spring-forward transition without skipping or duplicating a day', () => {
    // US DST begins 2026-03-08. A walk that added 24h of wall clock would land
    // twice on the same day here; UTC days are always 24 hours.
    const dates = withTimeZone(NEW_YORK, () => plainDateRange('2026-03-07', '2026-03-10'));
    expect(dates).toEqual(['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10']);
  });

  it('crosses a fall-back transition the same way', () => {
    const dates = withTimeZone(NEW_YORK, () => plainDateRange('2026-10-31', '2026-11-02'));
    expect(dates).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('crosses a month and a year boundary', () => {
    expect(plainDateRange('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  it('includes the single day of a one-day range', () => {
    expect(plainDateRange(FIRST_DAY, FIRST_DAY)).toEqual([FIRST_DAY]);
  });
});

describe('plainDateRange — a range that does not exist is empty, not guessed', () => {
  it('returns nothing when a bound is missing', () => {
    expect(plainDateRange(undefined, LAST_DAY)).toEqual([]);
    expect(plainDateRange(FIRST_DAY, undefined)).toEqual([]);
    expect(plainDateRange()).toEqual([]);
  });

  it('returns nothing when a bound is not a calendar date', () => {
    // An instant is the specific wrong input worth naming: it is what a caller
    // reaches for when it has a stamp rather than a day, and the prefix-match
    // that would accept it is how a zone-less day and an instant get confused.
    expect(plainDateRange('2026-09-12T00:00:00Z', LAST_DAY)).toEqual([]);
    expect(plainDateRange('not-a-date', LAST_DAY)).toEqual([]);
    expect(plainDateRange('2026-9-12', LAST_DAY)).toEqual([]);
  });

  it('returns nothing when the end precedes the start', () => {
    expect(plainDateRange(LAST_DAY, FIRST_DAY)).toEqual([]);
  });
});
