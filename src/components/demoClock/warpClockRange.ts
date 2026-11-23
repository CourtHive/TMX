/**
 * Where the warp clock may go, and where Exit Warp lands (CA 2026-11-22).
 *
 * - From the clock's current day, never earlier: the clock only moves forward (calls and results it stamped cannot be
 *   rewound, `setDemoClockTime`), and it starts no earlier than the moment the warp began.
 * - To the day after the tournament's last day, never later: one day past the end shows the finished tournament, and
 *   nothing further has anything to show. A clock already past that keeps its own day, so the picker is never empty.
 * - Exit Warp stays on the page the operator is looking at, mapped back from the sandbox copy to the original. A page
 *   about an event, draw or structure made in the sandbox steps up to the nearest level the original has.
 *
 * Pure: the caller hands in the dates, the routes and the original record.
 */

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` plus whole days, on the calendar (no zone: a date is a day, not an instant) */
export function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** the day after the tournament's last day: the latest day the warp clock may reach */
export function warpLastDate(endDate?: string): string | undefined {
  return endDate ? addCalendarDays(endDate.slice(0, 10), 1) : undefined;
}

/** every day the warp clock may be set to, ascending: from the clock's day to the day after the end */
export function warpClockDates({ clockDate, endDate }: { clockDate: string; endDate?: string }): string[] {
  const last = warpLastDate(endDate);
  if (!last || last <= clockDate) return [clockDate];
  const dates: string[] = [];
  for (let date = clockDate; date <= last; date = addCalendarDays(date, 1)) dates.push(date);
  return dates;
}

type IdRecord = {
  events?: {
    eventId: string;
    drawDefinitions?: { drawId: string; structures?: { structureId: string }[] }[];
  }[];
};

const LEVELS = ['event', 'draw', 'structure'] as const;

/**
 * The route Exit Warp lands on: the current route with the sandbox copy's id replaced by the original's, cut back to
 * the last level the original record has. `undefined` when the current route is not about the sandbox copy (the
 * caller then keeps its own return path).
 */
export function warpExitPath({
  current,
  copyId,
  sourceId,
  record,
}: {
  current: string;
  copyId: string;
  sourceId?: string;
  record?: IdRecord;
}): string | undefined {
  const path = current.replace(/^#/, '');
  const prefix = `/tournament/${copyId}`;
  if (!sourceId || !(path === prefix || path.startsWith(`${prefix}/`))) return undefined;
  const segments = `/tournament/${sourceId}${path.slice(prefix.length)}`.split('/');

  const events = record?.events ?? [];
  const event = (id: string) => events.find((candidate) => candidate.eventId === id);
  const draw = (id: string) =>
    events.flatMap((candidate) => candidate.drawDefinitions ?? []).find((candidate) => candidate.drawId === id);
  let eventId: string | undefined;
  let drawId: string | undefined;
  for (let index = 3; index < segments.length; index += 1) {
    const level = segments[index - 1] as (typeof LEVELS)[number];
    if (!LEVELS.includes(level)) continue;
    const id = segments[index];
    const known =
      (level === 'event' && !!event(id)) ||
      (level === 'draw' &&
        !!draw(id) &&
        (!eventId || !!event(eventId)?.drawDefinitions?.some((d) => d.drawId === id))) ||
      (level === 'structure' && !!draw(drawId ?? '')?.structures?.some((s) => s.structureId === id));
    if (!known) {
      // an unknown event leaves the events tab; an unknown draw or structure leaves the level above it
      const kept = segments.slice(0, index - 1);
      return level === 'event' ? `${kept.join('/')}/events` : kept.join('/');
    }
    if (level === 'event') eventId = id;
    if (level === 'draw') drawId = id;
  }
  return segments.join('/');
}

type AvailabilityCourt = { dateAvailability?: { date?: string; startTime?: string }[] };
type DefaultVenue = { defaultStartTime?: string };

/** when the day opens at the venue: the earliest court start on `date` (its own availability, else the court's
 * default), else the earliest venue default start, else 08:00 */
export function dayOpening({
  courts = [],
  venues = [],
  date,
}: {
  courts?: AvailabilityCourt[];
  venues?: DefaultVenue[];
  date: string;
}): string {
  const earliest = (times: (string | undefined)[]) =>
    times.filter((time): time is string => !!time).sort((a, b) => a.localeCompare(b))[0];
  const courtStart = earliest(
    courts.map((court) => {
      const own = court.dateAvailability?.find((availability) => availability.date === date);
      return (own ?? court.dateAvailability?.find((availability) => !availability.date))?.startTime;
    }),
  );
  return courtStart ?? earliest(venues.map((venue) => venue.defaultStartTime)) ?? '08:00';
}

/** `minutes` before `time` (`HH:MM`), never before midnight: the director's prep time before the day opens */
export function prepTime(time: string, minutes = 60): string {
  const [hours, mins] = time.split(':').map(Number);
  const total = Math.max(0, hours * 60 + mins - minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
