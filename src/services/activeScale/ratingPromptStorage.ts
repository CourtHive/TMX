/**
 * Per-tournament "active rating prompt already dismissed" flags.
 *
 * Separate from `tmx_settings` so it doesn't bloat the main prefs blob
 * and so a settings reset doesn't lose the user's per-tournament answers.
 */

const KEY = 'tmx_rating_prompt_dismissed';

type DismissedMap = Record<string, true>;

function read(): DismissedMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as DismissedMap) : {};
  } catch {
    return {};
  }
}

function write(map: DismissedMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // localStorage may be unavailable (private mode, quota). Silent swallow —
    // worst case: the user gets re-prompted on next load of this tournament.
  }
}

export function wasRatingPromptDismissed(tournamentId: string): boolean {
  if (!tournamentId) return false;
  return read()[tournamentId] === true;
}

export function markRatingPromptDismissed(tournamentId: string): void {
  if (!tournamentId) return;
  const map = read();
  if (map[tournamentId]) return;
  map[tournamentId] = true;
  write(map);
}
