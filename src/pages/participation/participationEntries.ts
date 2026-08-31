/**
 * Pure shaping for the participation read model — response → rows, and calendar-day formatting.
 *
 * Kept apart from the renderer for one reason above all: **"nothing came back" and "nothing took
 * part" must never collapse into the same state.** A provider with no fixtures in the corpus is an
 * ordinary, correct answer (59 seeded team providers are in that position), while a 403, a network
 * failure or a malformed body is a fault. Rendered identically, an operator reads a real outage as
 * "this programme has no season". {@link readParticipationResponse} is where the two are told
 * apart, and it is unit-tested in both directions.
 */

/** The read model's own vocabulary. Deliberately not `factoryConstants.participantTypes`: that set
 * is INDIVIDUAL | PAIR | TEAM | GROUP, and PERSON — the other participation grain — has no member
 * there. Two vocabularies that happen to share the token `TEAM` are still two vocabularies. */
export const SUBJECT_TYPE_TEAM = 'TEAM';

export interface ParticipationEntry {
  subjectType: string;
  subjectId: string;
  tournamentId: string;
  tournamentName?: string;
  participantId?: string;
  providerId?: string;
  startDate?: string;
  endDate?: string;
  eventCount?: number;
}

export type ParticipationResult = { status: 'ok'; entries: ParticipationEntry[] } | { status: 'error'; reason: string };

/**
 * Read the `GET /participation/:subjectType/:subjectId` response.
 *
 * `baseApi` resolves a rejected request to `undefined` rather than rejecting, and a server-side
 * refusal can arrive as a 200 carrying `{ error }`. Neither has an `entries` array, so the presence
 * of that array — not the absence of an error field — is what makes a response readable.
 */
export function readParticipationResponse(response: any): ParticipationResult {
  if (!response) return { status: 'error', reason: 'no-response' };
  const data = response.data;
  if (data?.error) return { status: 'error', reason: 'server-error' };
  if (!Array.isArray(data?.entries)) return { status: 'error', reason: 'malformed' };
  return { status: 'ok', entries: data.entries as ParticipationEntry[] };
}

export interface ParticipationYearGroup {
  year: string;
  entries: ParticipationEntry[];
}

/**
 * Group fixtures under the calendar year of their start date, preserving the order the server sent
 * (earliest first, which is what makes a season readable top to bottom).
 *
 * The calendar year, NOT a competitive season: a college season spans autumn into spring, and
 * deriving "2025–26" from a date would be an inference this data does not license. A year heading
 * restates a fact already in the row; a season heading would assert one that is not.
 *
 * A fixture with no parseable start date is grouped under `''` and rendered last, visibly
 * undated — never silently dropped, and never defaulted onto a year it might not belong to.
 */
export function groupEntriesByYear(entries: ParticipationEntry[]): ParticipationYearGroup[] {
  const groups: ParticipationYearGroup[] = [];
  const byYear = new Map<string, ParticipationYearGroup>();

  for (const entry of entries) {
    const year = calendarYear(entry.startDate);
    let group = byYear.get(year);
    if (!group) {
      group = { year, entries: [] };
      byYear.set(year, group);
      groups.push(group);
    }
    group.entries.push(entry);
  }

  // Undated fixtures sort last; everything else keeps arrival order.
  return groups.toSorted((a, b) => Number(!a.year) - Number(!b.year));
}

function calendarYear(isoDay?: string): string {
  const parts = parseCalendarDay(isoDay);
  return parts ? String(parts.year) : '';
}

interface CalendarDayParts {
  year: number;
  month: number;
  day: number;
}

/**
 * Split `YYYY-MM-DD` into its components without constructing a Date.
 *
 * `new Date('2026-03-04')` is UTC midnight, so `toLocaleDateString()` renders 3 March for anyone
 * west of Greenwich — the calendar-day shift that has already cost this ecosystem a FERPA-protected
 * date of birth (architectural standard A11). Parsing the string keeps the boundary a string, which
 * is also the shape the factory's Temporal migration wants.
 */
export function parseCalendarDay(isoDay?: string): CalendarDayParts | undefined {
  if (typeof isoDay !== 'string') return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return { year, month, day };
}

/**
 * Render one calendar day for display.
 *
 * The instant is built with `Date.UTC` and read back pinned to `timeZone: 'UTC'`, so the day that
 * comes out is exactly the day that went in, in every zone. Pass an explicit `locale` where the
 * output is asserted; the runtime default is right for the UI and wrong for a test.
 */
export function formatCalendarDay(isoDay?: string, locale?: string): string {
  const parts = parseCalendarDay(isoDay);
  if (!parts) return '';
  const instant = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return instant.toLocaleDateString(locale, { timeZone: 'UTC', month: 'short', day: 'numeric' });
}

/** A fixture's dates: one day, or a range when it spans more than one. */
export function formatFixtureDates(startDate?: string, endDate?: string, locale?: string): string {
  const start = formatCalendarDay(startDate, locale);
  if (!start) return '';
  const end = formatCalendarDay(endDate, locale);
  if (!end || end === start) return start;
  return `${start} – ${end}`;
}
