/**
 * Renders the factory's `matchUp.updatedAt` ISO UTC stamp as a
 * locale-neutral `YYYY-MM-DD HH:MM` string. Accepts an optional IANA
 * time-zone so the tournament's canonical zone (if set on the
 * tournamentRecord) wins over whatever machine the table is being
 * viewed on — otherwise falls back to the viewer's local zone.
 *
 * Why not `toLocaleDateString` or `toLocaleString`? Those produce
 * different output per locale (`"4/16/2026"` in US, `"16/04/2026"` in
 * UK, `"16.04.2026"` in DE) which is visually noisy in a data table
 * and breaks lexicographic column sort. The `YYYY-MM-DD HH:MM` form is
 * uniform, narrow, and sorts correctly as a plain string.
 *
 * The raw ISO stamp is still attached to the cell's `title` attribute
 * by the Tabulator wrapper so full-fidelity value is recoverable on
 * hover.
 */

/** Zero-pad a number to at least 2 digits. */
function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Validate an IANA zone string. Returns true when the runtime's
 * Intl database accepts it. Empty / undefined returns false — caller
 * decides whether to fall back to local rendering.
 */
function isValidTimeZone(timeZone?: string): timeZone is string {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Pure core — takes an ISO string (or any Date-parseable value) and
 * returns `YYYY-MM-DD HH:MM` in the requested zone, or the viewer's
 * local zone if no valid `timeZone` is supplied. Returns `''` for
 * falsy / unparseable input.
 *
 * Deliberately truncates seconds/ms — the stamp's wall-clock precision
 * is milliseconds, but minute resolution is the right grain for a
 * table audit column. The raw ISO stays in the tooltip for users who
 * need finer detail.
 */
export function formatUpdatedAt(value: unknown, timeZone?: string): string {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value as string);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';

  if (isValidTimeZone(timeZone)) {
    // Use Intl with the requested IANA zone. `en-CA` gives us
    // `YYYY-MM-DD, HH:MM` which we normalise to `YYYY-MM-DD HH:MM`.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(date);
    const grab = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const y = grab('year');
    const mo = grab('month');
    const d = grab('day');
    // `hour` can come back as '24' in some zones on midnight boundaries
    // (older Node / Safari quirk); normalise to '00'.
    const rawHour = grab('hour');
    const h = rawHour === '24' ? '00' : rawHour;
    const mi = grab('minute');
    if (!y || !mo || !d || !h || !mi) return '';
    return `${y}-${mo}-${d} ${h}:${mi}`;
  }

  // Fallback: viewer's local zone via direct Date accessors.
  const y = date.getFullYear();
  const mo = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

/**
 * Build a Tabulator cell formatter closed over a fixed time zone.
 * `getMatchUpColumns` resolves the active tournament's
 * `localTimeZone` once when columns are built; re-building columns
 * after a tournament-timezone edit picks up the new zone.
 */
export function makeUpdatedAtFormatter(timeZone?: string) {
  return (cell: any): string => {
    const raw = cell.getValue();
    if (typeof raw === 'string' && raw) {
      cell.getElement()?.setAttribute('title', raw);
    }
    return formatUpdatedAt(raw, timeZone);
  };
}

/**
 * Back-compat default formatter that renders in the viewer's local
 * zone. Retained so legacy callers / stories keep working; new
 * callers with access to a tournament record should use
 * `makeUpdatedAtFormatter(localTimeZone)` instead.
 */
export const updatedAtFormatter = makeUpdatedAtFormatter();
