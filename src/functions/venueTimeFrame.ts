/**
 * The **venue time frame** — TMX's single answer to "what time is it at the
 * tournament?"
 *
 * ── Why this module exists ──
 *
 * A stored instant (`calledAt`, `scoredTime`, an embargo stamp) is a point on
 * the world's timeline. Turning it into a clock time or a calendar day requires
 * a zone, and TMX used to answer that question independently at ~a dozen sites,
 * every one of them with the **browser's** zone. A director running a Florida
 * event from a Pacific-set laptop read rest, call times and order-of-play timing
 * three hours out — silently, in numbers that stayed plausible, which is what
 * made it expensive. Two independent sightings on one day (TMX #1355, #1356)
 * made it a bug class rather than a bug.
 *
 * The decision is recorded in `Mentat/planning/DECISION_VENUE_TIME_FRAME.md`.
 * The short form:
 *
 *   **Every conversion of a stored instant to a clock time or a calendar day
 *   goes through this module, in the tournament's zone, resolved per instant.**
 *
 * ── Per instant, not a stored offset ──
 *
 * A bare `utcOffsetMinutes` is the offset at ONE moment. A tournament spanning a
 * DST change converts an hour wrong on the far side — silently, in figures
 * measured in minutes. Measured across the 2026 US spring-forward, 22:00 → 08:00
 * is nine hours, not ten. So every function here resolves the offset **at the
 * instant being converted**, via `Intl.DateTimeFormat` with an IANA zone. This
 * is the approach `factory/src/tools/zonedTime.ts` takes; it is internal to the
 * factory and not exported from `assemblies`, so TMX ports it rather than
 * importing it.
 *
 * ── What is NOT an instant ──
 *
 * The distinction this module lives or dies by. Two different things in TMX look
 * alike and must never be run through the same conversion:
 *
 *   - **Instants** — `calledAt`, `scoredTime`, `updatedAt`, `createdAt`: full
 *     UTC ISO stamps. These need a zone. That is what this module is for.
 *   - **Naive wall clocks** — `scheduledTime`, `startTime`, `endTime`, court
 *     block `start`/`end`, and any `new Date('YYYY-MM-DDTHH:MM:SS')` with no
 *     trailing `Z`. These are ALREADY in venue wall-clock terms and carry no
 *     zone. Converting one is the bug, not the fix: read them with the raw
 *     `getHours()` accessors, which recover exactly the digits that were
 *     written. Comparisons between two naive values are zone-independent
 *     because the browser's zone cancels on both sides.
 *
 * Treating a naive wall clock as an instant — or the reverse — produces a figure
 * wrong by the UTC offset, which is worse than showing nothing.
 *
 * ── Which instants are venue-framed ──
 *
 * An instant describing something that happened **at the venue**, or that a
 * venue clock is measured against, is venue-framed: calls, scores, sign-ins,
 * embargoes, publish stamps. An instant describing the **operator's own
 * session** — a chat message, a local draft's `resolvedAt` — stays in the
 * operator's zone, because "when I saw it" is the question those answer. That
 * line is deliberate; it is not an oversight in the sites this module does not
 * touch.
 */
import { isValidTimeZone } from 'functions/getSupportedTimeZones';
import { tournamentEngine } from 'services/factory/engine';

export type VenueFrameSource = 'tournament' | 'browser';

export type VenueFrame = {
  /** IANA identifier, e.g. `America/New_York`. Always a usable zone. */
  timeZone: string;
  /**
   * `'tournament'` when the record carries a zone; `'browser'` when it does
   * not and the runtime's own zone is standing in. Callers that render times
   * to an operator should surface the `'browser'` case — see
   * `renderVenueFrameNotice`.
   */
  source: VenueFrameSource;
};

export type VenueParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const MS_PER_MINUTE = 60_000;

/**
 * `Intl.DateTimeFormat` construction is expensive enough to matter on the Now
 * strip, which re-renders every 30s across every court. One formatter per zone,
 * built once.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

/** The runtime's own IANA zone, or `'UTC'` when the platform will not name one. */
export function browserTimeZone(): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof detected === 'string' && detected.length ? detected : 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * The frame every instant→clock conversion in TMX should be read against.
 *
 * `tournamentRecord.localTimeZone` is the authoritative venue zone: it is
 * operator-set through the Edit Dates modal, validated against a supported-zones
 * list, and never silently auto-applied (`getDetectedTimeZone()` is a nudge the
 * TD must confirm).
 *
 * When the record carries none, the browser's zone stands in — and the caller is
 * expected to say so on screen. Refusing to render times instead would break the
 * running desk for every zone-less tournament, which is most of them today; a
 * *silent* browser fallback would reproduce, through a different door, exactly
 * the wrongness this module exists to eliminate. So the fallback stays and
 * announces itself: the one case where the page can be wrong is the one case
 * where it says so.
 *
 * Cheap enough to call per site. What must never be re-implemented per site is
 * the **fallback rule** — that is the whole point of there being one function.
 */
export function resolveVenueFrame(): VenueFrame {
  let localTimeZone: string | undefined;
  try {
    localTimeZone = tournamentEngine.q.tournament()?.localTimeZone;
  } catch {
    localTimeZone = undefined;
  }
  if (isValidTimeZone(localTimeZone)) return { timeZone: localTimeZone, source: 'tournament' };
  return { timeZone: browserTimeZone(), source: 'browser' };
}

/** Convenience for the common case: the zone alone. */
export function venueTimeZone(): string {
  return resolveVenueFrame().timeZone;
}

function toDate(value?: string | number | Date): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function resolveZone(timeZone?: string): string {
  return isValidTimeZone(timeZone) ? timeZone : browserTimeZone();
}

/**
 * An instant, broken into its calendar/clock fields **in the given zone**.
 *
 * Returns `undefined` for unparseable input rather than a substituted default —
 * a wrong time is worse than a missing one everywhere this is used.
 */
export function venueParts(value?: string | number | Date, timeZone?: string): VenueParts | undefined {
  const date = toDate(value);
  if (!date) return undefined;

  const parts = partsFormatter(resolveZone(timeZone)).formatToParts(date);
  const grab = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';

  const year = Number(grab('year'));
  const month = Number(grab('month'));
  const day = Number(grab('day'));
  // `hour` comes back as '24' rather than '00' at midnight in some engines
  // (an older Node / Safari quirk); normalise before it becomes an off-by-a-day.
  const rawHour = grab('hour');
  const hour = rawHour === '24' ? 0 : Number(rawHour);
  const minute = Number(grab('minute'));
  const second = Number(grab('second'));

  if ([year, month, day, hour, minute, second].some((n) => !Number.isFinite(n))) return undefined;
  return { year, month, day, hour, minute, second };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * The calendar day an instant falls on **at the venue**, as `YYYY-MM-DD`.
 *
 * Never `toISOString().slice(0, 10)`: that reports the UTC day, so west of
 * Greenwich it rolls over while the tournament is still playing — at 8pm in
 * Florida it already says tomorrow. Shipping that once (#1352, fixed in #1355)
 * made every official read "available" every evening.
 *
 * Defaults to now, which is the "what day is it?" every schedule surface asks.
 */
export function venueCalendarDate(value?: string | number | Date, timeZone?: string): string {
  const parts = venueParts(value ?? new Date(), timeZone);
  if (!parts) return '';
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** An instant as a `HH:MM` venue wall clock. Defaults to now. Empty string when unparseable. */
export function venueClock(value?: string | number | Date, timeZone?: string): string {
  const parts = venueParts(value ?? new Date(), timeZone);
  if (!parts) return '';
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/** An instant as minutes from venue midnight (`14:20` → `860`). Defaults to now. */
export function venueDayMinutes(value?: string | number | Date, timeZone?: string): number | undefined {
  const parts = venueParts(value ?? new Date(), timeZone);
  if (!parts) return undefined;
  return parts.hour * 60 + parts.minute;
}

/**
 * The zone's UTC offset **at a particular instant**, in minutes east of UTC.
 *
 * The whole reason this takes an instant rather than returning a constant: a
 * zone's offset is a function of when you ask.
 */
export function venueOffsetMinutesAt(value: string | number | Date, timeZone?: string): number | undefined {
  const date = toDate(value);
  const parts = venueParts(date, timeZone);
  if (!date || !parts) return undefined;
  const asIfUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asIfUtc - date.getTime()) / MS_PER_MINUTE);
}

/**
 * The inverse: a venue wall clock (`'2026-08-25'`, `'14:20'`) → absolute UTC ms.
 *
 * Needed wherever a planned time has to be compared with an actual instant —
 * the Call Timing Variance report is the case that forced it, where "scheduled
 * 15:00" and "called at <ISO>" must be subtracted.
 *
 * Two passes, because resolving the offset needs an instant and finding the
 * instant needs the offset: guess with the offset at the naive-as-UTC moment,
 * then re-resolve at the guess. That converges everywhere except the one hour
 * that does not exist (spring-forward) and the one that happens twice
 * (fall-back), where it settles on a consistent answer rather than a correct
 * one — there isn't a correct one to settle on.
 */
export function venueWallClockToMs(date?: string, clock?: string, timeZone?: string): number | undefined {
  if (!date || !clock) return undefined;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(date.trim());
  const clockMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(clock.trim());
  if (!dateMatch || !clockMatch) return undefined;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(clockMatch[1]);
  const minute = Number(clockMatch[2]);
  const second = Number(clockMatch[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return undefined;

  const zone = resolveZone(timeZone);
  const naiveAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstOffset = venueOffsetMinutesAt(naiveAsUtc, zone);
  if (firstOffset === undefined) return undefined;
  const guess = naiveAsUtc - firstOffset * MS_PER_MINUTE;
  const secondOffset = venueOffsetMinutesAt(guess, zone);
  if (secondOffset === undefined) return undefined;
  return naiveAsUtc - secondOffset * MS_PER_MINUTE;
}

/**
 * "Now", projected onto the venue wall clock of `stripDate`, as a **naive**
 * Date — i.e. one whose raw `getHours()` accessors read back the venue clock.
 *
 * That naivety is deliberate and load-bearing. The values this gets compared
 * against (court block `start`/`end`) are themselves naive `YYYY-MM-DDTHH:MM:SS`
 * strings in venue wall-clock terms, parsed as browser-local. Comparing two
 * naive Dates cancels the browser's zone on both sides; the only thing that has
 * to be right is the **time-of-day**, and that is what this fixes.
 *
 * Projecting today's time-of-day onto another date is what lets the live-strip
 * warnings work when the operator is viewing a non-today date — which is not an
 * exotic case: the schedule opens on a tournament's last date once its dates are
 * past, so anyone running a past-dated tournament in real time is in it
 * permanently.
 */
export function venueNowOnDate(stripDate: string, timeZone?: string): Date {
  const parts = venueParts(new Date(), timeZone);
  if (!parts) return new Date(`${stripDate}T00:00:00`);
  return new Date(`${stripDate}T${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`);
}
