/**
 * Schedule2 — turning "block this court from 14:30 to 16:00" into a court record edit.
 *
 * ── Why the Now strip needed its own blocking at all ──
 *
 * The strip's cell click routes into the GRID's cell menu, whose block options
 * call `addCourtGridBooking` — a booking keyed by `courtOrder` and `rowCount`,
 * with no `startTime` or `endTime`. That is the right vocabulary *for the grid*,
 * where a director spaces matchUps down a column so rows approximate time bands
 * (CA, 2026-09-13). It is the wrong vocabulary for the strip, which has no rows,
 * only a clock — and the consequence was not merely untidy:
 *
 *   - the strip's own block banners come from `AvailabilityEngine.getDayBlocks`,
 *     and `createBlockFromBooking` opens with
 *     `if (!booking.startTime || !booking.endTime) return;`
 *     so a booking made from the strip was invisible **on the strip that made
 *     it**;
 *   - a free strip cell carries no `rowIndex`, so the courtOrder fell back to
 *     `1` — blocking the court's first grid row, usually a slot from
 *     this morning.
 *
 * So this writes real time bookings through `modifyCourtAvailability`, the same
 * path the Availability tab uses, and the result shows up everywhere blocks are
 * read.
 *
 * Pure and DOM-free. The modal builds rows; this decides what they mean.
 */

/** One from/to period the operator has entered. */
export interface TimeBlockRow {
  startTime: string;
  endTime: string;
  bookingType: string;
}

export type TimeBlockError = 'incomplete' | 'inverted' | 'none';

/** `HH:MM` → minutes from midnight; undefined for anything that is not a clock. */
function clockMinutes(value: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

/**
 * Why these rows cannot be saved, or `undefined` when they can.
 *
 * Deliberately a single reason rather than a per-row map: the modal disables one
 * Save button, and the operator fixes what they can see. `none` covers the empty
 * case, which is a different statement from "these rows are wrong".
 */
export function timeBlockError(rows: TimeBlockRow[]): TimeBlockError | undefined {
  const filled = rows.filter((row) => row.startTime || row.endTime);
  if (!filled.length) return 'none';
  if (filled.some((row) => !row.startTime || !row.endTime)) return 'incomplete';

  for (const row of filled) {
    const start = clockMinutes(row.startTime);
    const end = clockMinutes(row.endTime);
    // A block that ends before it starts is not a midnight-crossing period — the
    // record is per DATE, so there is no next day to cross into.
    if (start === undefined || end === undefined || end <= start) return 'inverted';
  }
  return undefined;
}

/** The rows worth writing — those the operator actually filled in. */
export function usableRows(rows: TimeBlockRow[]): TimeBlockRow[] {
  return rows.filter((row) => row.startTime && row.endTime);
}

/**
 * The court's open window for a date, used when the date has no entry yet.
 *
 * `validDateAvailability` REJECTS an entry without `startTime`/`endTime`, so a
 * new entry cannot carry bookings alone — it has to say when the court is open
 * that day. The court's own date-less default is the honest source: it is
 * exactly the statement "this is when this court is open, on any day".
 *
 * Falling back to another dated entry is second-best but better than inventing
 * hours, and returning undefined (no entry anywhere) is reported rather than
 * papered over, because a guess would silently change when a court is open.
 */
export function openWindowFor(existing: any[], date: string): { startTime: string; endTime: string } | undefined {
  const dated = existing.find((entry) => entry?.date === date && entry.startTime && entry.endTime);
  if (dated) return { startTime: dated.startTime, endTime: dated.endTime };

  const dateless = existing.find((entry) => entry && entry.date === undefined && entry.startTime && entry.endTime);
  if (dateless) return { startTime: dateless.startTime, endTime: dateless.endTime };

  const any = existing.find((entry) => entry?.startTime && entry.endTime);
  return any ? { startTime: any.startTime, endTime: any.endTime } : undefined;
}

/**
 * A court's `dateAvailability` with the operator's periods added as bookings on
 * `date`, or undefined when the court has no open window to hang them on.
 *
 * Every other entry is passed through untouched — including a date-less default,
 * which the factory used to corrupt into `date: "undefined"` on the way past
 * (fixed in `#4866(factory)`). Merging into the target entry rather than
 * rebuilding it is the same reasoning as `capacityPopoverLogic`: an editor that
 * discards what it does not understand is a trap.
 */
export function addBookingsToDateAvailability(existing: any, date: string, rows: TimeBlockRow[]): any[] | undefined {
  const list: any[] = Array.isArray(existing) ? [...existing] : [];
  const bookings = usableRows(rows).map((row) => ({
    startTime: row.startTime,
    endTime: row.endTime,
    bookingType: row.bookingType,
  }));
  if (!bookings.length) return undefined;

  const index = list.findIndex((entry) => entry?.date === date);
  if (index >= 0) {
    list[index] = { ...list[index], bookings: [...(list[index].bookings ?? []), ...bookings] };
    return list;
  }

  const window = openWindowFor(list, date);
  if (!window) return undefined;
  list.push({ date, ...window, bookings });
  return list;
}

/** `14:07` → `14:15` — the next quarter hour, which is the availability grid's own granularity. */
export function roundUpToQuarter(minutes: number): number {
  return Math.min(23 * 60 + 45, Math.ceil(minutes / 15) * 15);
}

/** minutes from midnight → `HH:MM`, the shape a native time input wants. */
export function toClock(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}
