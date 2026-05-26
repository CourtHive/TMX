/**
 * Per-user preference for the minimum schedule-grid court cell width.
 *
 * Local-only (localStorage) — different scorekeepers can prefer different cell
 * densities on the same tournament, so this is intentionally NOT persisted as
 * a tournament extension.
 *
 * The current hardcoded grid floor is 110px (GRID_MIN_COURT_WIDTH_PX in
 * gridView.ts); that's also our default and the bottom of the user-adjustable
 * range. Values above the default just give more breathing room before the
 * grid starts horizontally scrolling.
 */

export const MIN_COURT_WIDTH_FLOOR = 110;
export const MIN_COURT_WIDTH_CEILING = 300;
export const MIN_COURT_WIDTH_STEP = 10;
export const DEFAULT_MIN_COURT_WIDTH = 110;

const STORAGE_KEY = 'schedule2:min-court-width';

export function readUserMinCourtWidth(): number {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULT_MIN_COURT_WIDTH;
  }
  if (raw === null) return DEFAULT_MIN_COURT_WIDTH;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_MIN_COURT_WIDTH;
  return clampMinCourtWidth(parsed);
}

export function writeUserMinCourtWidth(value: number): void {
  const clamped = clampMinCourtWidth(value);
  try {
    localStorage.setItem(STORAGE_KEY, String(clamped));
  } catch {
    // storage unavailable — preference is ephemeral for this session
  }
}

function clampMinCourtWidth(value: number): number {
  return Math.max(MIN_COURT_WIDTH_FLOOR, Math.min(MIN_COURT_WIDTH_CEILING, Math.floor(value)));
}
