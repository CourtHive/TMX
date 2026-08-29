/**
 * Every export here returns an `HTMLSpanElement`, and TMX runs vitest without a
 * DOM — so a value test cannot call one. What CAN be pinned, and is the thing
 * that actually regressed, is which clock the module reads.
 *
 * `calledAt` is a full ISO **instant**. #1362 moved the venue frame across the
 * schedule surface but missed `calledAtFormatter`, leaving the matchUps table
 * disagreeing with itself: `matchUpStatusPredicates.isCalledForScheduledDay`
 * bucketed a row as called-today on the VENUE's clock while the cell beside it
 * printed the OPERATOR's. Two surfaces, one matchUp, two answers — precisely the
 * mixed-convention page `Mentat/planning/DECISION_VENUE_TIME_FRAME.md` exists to
 * prevent.
 *
 * Guarded at the source, the same way `signInPresence.test.ts` guards its own
 * UTC-day bug and for the same reason: under `TZ=UTC` the browser-zone
 * implementation and the venue-zone one produce identical output, so no
 * assertion on a rendered value could tell them apart even with a DOM.
 */
import { calledAtClock } from './scheduleStatusFormatter';
import { venueClock } from 'functions/venueTimeFrame';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/** Source with comments stripped — the guards must match code, not prose about code. */
const code = readFileSync(new URL('./scheduleStatusFormatter.ts', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

describe('scheduleStatusFormatter reads the venue clock, never the browser`s', () => {
  it('can see the code — otherwise every guard below passes on an empty string', () => {
    expect(code).toContain('export function calledAtFormatter');
    expect(code).toContain('export function scheduleTimeFormatter');
  });

  it('derives no clock or calendar value from browser-local accessors', () => {
    for (const accessor of ['getHours()', 'getMinutes()', 'getFullYear()', 'getMonth()', 'getDate()']) {
      expect(code).not.toContain(accessor);
    }
  });

  it('never derives a calendar day from toISOString — that is UTC, not the venue', () => {
    expect(code).not.toMatch(/toISOString\(\)\s*\.slice\(/);
    expect(code).not.toMatch(/toISOString\(\)\s*\.split\(/);
  });

  it('routes through the venue frame', () => {
    expect(code).toContain('venueTimeFrame');
    // `calledAt` is an instant and must go through `venueClock`; `scheduledDate`
    // / `scheduledTime` are bare venue wall clocks compared against "now", which
    // is why the module needs both the day and the clock.
    expect(code).toContain('venueClock');
    expect(code).toContain('venueCalendarDate');
  });
});

/**
 * The guards above are source-greps, and source-greps are why the next bug got
 * to production: #1364's `calledAtFormatter` mentioned `venueClock`, satisfying
 * every assertion in the block above, while rendering the CURRENT time into the
 * Called column of every matchUp that had never been called. A tournament a day
 * before its start date showed its entire draw called to court, all at the same
 * clock, ticking forward on each redraw.
 *
 * The cause is that `venueClock` DEFAULTS TO NOW for empty input, so the
 * formatter's own `if (!clock) return ''` is unreachable for an absent stamp.
 * That is a value fact, not a which-imports-does-it-use fact, so it needs a
 * value test — hence `calledAtClock`, extracted purely so this can exist without
 * a DOM.
 */
describe('calledAtClock renders nothing for a matchUp that was never called', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty string', ''],
  ])('returns empty for %s rather than substituting now', (_label, value) => {
    expect(calledAtClock(value as any)).toBe('');
  });

  it('returns empty for an unparseable stamp', () => {
    expect(calledAtClock('not-a-date')).toBe('');
  });

  it('still renders a real call stamp as a HH:MM clock', () => {
    // Asserted as a SHAPE plus agreement with `venueClock`, not as a fixed
    // string: no tournament record is loaded here, so the venue frame falls back
    // to the runtime zone and any literal would pin the test to whatever TZ the
    // runner happened to export. What must hold is that a real stamp survives
    // the guard and is handed to the venue clock unchanged.
    const stamp = '2026-08-28T21:02:00.000Z';
    expect(calledAtClock(stamp)).toMatch(/^\d{2}:\d{2}$/);
    expect(calledAtClock(stamp)).toBe(venueClock(stamp));
  });

  it('never returns the current clock for an absent stamp, whatever time it is', () => {
    const now = new Date().toISOString();
    expect(calledAtClock(undefined)).not.toBe(calledAtClock(now));
  });
});
