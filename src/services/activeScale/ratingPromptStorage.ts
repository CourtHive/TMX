/**
 * Per-tournament memory of the rating prompt: which available-scale set
 * the user was last asked about. We re-prompt iff the current available
 * set differs from the stored one. This makes the prompt auto-recover
 * when a tournament gains or loses a rating type after the user already
 * answered for the old set.
 *
 * Separate from `tmx_settings` so it doesn't bloat the main prefs blob
 * and so a settings reset doesn't lose the user's per-tournament answers.
 */

const KEY = 'tmx_rating_prompt_dismissed';

type DismissedMap = Record<string, string[]>;

function normalize(scales: string[]): string[] {
  return Array.from(new Set((scales || []).map((s) => String(s).toLowerCase()).filter(Boolean))).sort();
}

function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

function read(): DismissedMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    // Coerce legacy `Record<string, true>` shape (initial implementation) into
    // the new `Record<string, string[]>`. Legacy entries become "answered for
    // an unknown set" — we treat unknown as "not equal to anything" so the
    // user gets re-prompted once on the next load, then we store the real set.
    const out: DismissedMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) out[k] = v as string[];
    }
    return out;
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

/**
 * Returns true iff the user was previously prompted for this tournament
 * **with the same set of available scales** as `currentScales`.
 */
export function wasRatingPromptDismissed(tournamentId: string, currentScales: string[]): boolean {
  if (!tournamentId) return false;
  const stored = read()[tournamentId];
  if (!stored) return false;
  return setsEqual(stored, normalize(currentScales));
}

/**
 * Record that the user has been prompted for this tournament with the
 * given available scale set. Idempotent: subsequent calls with the same
 * set are no-ops; calls with a different set overwrite (the new set
 * becomes the one we won't re-ask about).
 */
export function markRatingPromptDismissed(tournamentId: string, currentScales: string[]): void {
  if (!tournamentId) return;
  const next = normalize(currentScales);
  const map = read();
  const existing = map[tournamentId];
  if (existing && setsEqual(existing, next)) return;
  map[tournamentId] = next;
  write(map);
}
