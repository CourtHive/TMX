/**
 * Renders the factory's `matchUp.updatedAt` ISO UTC stamp as a
 * locale-neutral `YYYY-MM-DD HH:MM` string in the user's local time.
 *
 * Why not `toLocaleDateString` or `toLocaleString`? Those produce
 * different output per locale (`"4/16/2026"` in US, `"16/04/2026"` in
 * UK, `"16.04.2026"` in DE) which is visually noisy in a data table
 * and breaks lexicographic column sort. The `YYYY-MM-DD HH:MM` form is
 * uniform, narrow, and sorts correctly as a plain string.
 *
 * The raw ISO stamp is still attached to the cell's `title` attribute
 * by the cell formatter so full-fidelity value is recoverable on hover.
 *
 * Kept in a dedicated module (rather than inline in the column config)
 * so the formatting logic is unit-testable — locale-dependent code in
 * table columns is otherwise invisible to the test suite.
 */

/** Zero-pad a number to at least 2 digits. */
function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Pure core — takes an ISO string (or any Date-parsable value) and
 * returns `YYYY-MM-DD HH:MM` in the user's local time zone, or an empty
 * string for falsy / unparsable input.
 *
 * Deliberately truncates seconds/milliseconds — the stamp's wall-clock
 * precision is milliseconds, but minute resolution is the right grain
 * for a table audit column. The raw ISO stays in the tooltip for
 * users who need finer detail.
 */
export function formatUpdatedAt(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value as string);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const mo = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

/**
 * Tabulator cell formatter. Returns the formatted display string and
 * also writes the raw ISO into the cell's `title` so hover shows the
 * unabbreviated stamp (with seconds + timezone).
 */
export function updatedAtFormatter(cell: any): string {
  const raw = cell.getValue();
  if (typeof raw === 'string' && raw) {
    cell.getElement()?.setAttribute('title', raw);
  }
  return formatUpdatedAt(raw);
}
