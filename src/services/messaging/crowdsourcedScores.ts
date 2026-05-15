/**
 * Crowdsourced score tracking — remembers which matchUps received a live
 * score event via the relay (`scoreRelay.ts`) so the operator can see a
 * persistent "scored via live tracker" indicator in tables and brackets.
 *
 * Storage: in-memory Map<matchUpId, { lastSeenAt }> + localStorage per
 * tournament (`crowdsourcedScores:<tournamentId>` → JSON object).
 *
 * Cleanup is two-tiered:
 *   1. TTL — entries older than `TTL_MS` are dropped at load time.
 *   2. Completion — `pruneCompletedMatchUps(ids)` drops any matchUp the
 *      caller indicates has finished. TMX calls this after tournament
 *      load and after relay events propagate, using the engine's
 *      authoritative `winningSide` / completed-status check to decide.
 *
 * Future Phase C (server-side) would derive provenance from the audit
 * log or a `RELAY_SCORE_SUBMITTED` timeItem on the matchUp itself,
 * making this localStorage shim unnecessary.
 */

const STORAGE_PREFIX = 'crowdsourcedScores:';
const TTL_MS = 24 * 60 * 60 * 1000;

interface Entry {
  lastSeenAt: string;
}

let activeTournamentId: string | undefined;
let activeMap: Map<string, Entry> = new Map();

function storageKey(tournamentId: string): string {
  return `${STORAGE_PREFIX}${tournamentId}`;
}

function now(): Date {
  return new Date();
}

function isExpired(entry: Entry, asOf: Date): boolean {
  const t = Date.parse(entry.lastSeenAt);
  if (Number.isNaN(t)) return true;
  return asOf.getTime() - t > TTL_MS;
}

function readFromStorage(tournamentId: string): Map<string, Entry> {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey(tournamentId));
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return new Map();
    const result = new Map<string, Entry>();
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof id !== 'string' || !id) continue;
      if (!value || typeof value !== 'object') continue;
      const lastSeenAt = (value as any).lastSeenAt;
      if (typeof lastSeenAt !== 'string') continue;
      result.set(id, { lastSeenAt });
    }
    return result;
  } catch {
    return new Map();
  }
}

function writeToStorage(tournamentId: string, map: Map<string, Entry>): void {
  try {
    if (map.size === 0) {
      globalThis.localStorage?.removeItem(storageKey(tournamentId));
      return;
    }
    const obj: Record<string, Entry> = {};
    for (const [id, entry] of map) obj[id] = entry;
    globalThis.localStorage?.setItem(storageKey(tournamentId), JSON.stringify(obj));
  } catch {
    // localStorage unavailable / quota exceeded — keep the in-memory map as truth.
  }
}

function pruneExpired(map: Map<string, Entry>, asOf: Date): boolean {
  let mutated = false;
  for (const [id, entry] of map) {
    if (isExpired(entry, asOf)) {
      map.delete(id);
      mutated = true;
    }
  }
  return mutated;
}

/**
 * Load any persisted entries for this tournament, drop ones past the TTL,
 * and make the remainder the active map. Call once per tournament load —
 * typically right after `connectRelay`.
 */
export function loadCrowdsourcedScores(tournamentId: string): void {
  activeTournamentId = tournamentId;
  activeMap = readFromStorage(tournamentId);
  if (pruneExpired(activeMap, now())) {
    writeToStorage(tournamentId, activeMap);
  }
}

/**
 * Record that a relay score arrived for this matchUp. Refreshes the
 * `lastSeenAt` on every call so an actively-tracked matchUp keeps its
 * 24-hour countdown rolling forward. Writes through to localStorage.
 */
export function markMatchUpCrowdsourced(matchUpId: string | undefined): void {
  if (!matchUpId || !activeTournamentId) return;
  activeMap.set(matchUpId, { lastSeenAt: now().toISOString() });
  writeToStorage(activeTournamentId, activeMap);
}

/**
 * Returns true if the matchUp has been marked as crowdsourced for the
 * currently-loaded tournament. Cheap — backed by an in-memory Map.
 */
export function isMatchUpCrowdsourced(matchUpId: string | undefined): boolean {
  if (!matchUpId) return false;
  return activeMap.has(matchUpId);
}

/**
 * Drop entries for matchUps the caller knows are complete. TMX wires
 * this to the engine's authoritative completed-status check after
 * tournament load and after each relay-score arrival so badges fall
 * away as soon as a match wraps up.
 *
 * Persists if anything changed. Returns the number of entries removed.
 */
export function pruneCompletedMatchUps(completedMatchUpIds: Iterable<string>): number {
  if (!activeTournamentId) return 0;
  let removed = 0;
  for (const id of completedMatchUpIds) {
    if (activeMap.delete(id)) removed += 1;
  }
  if (removed > 0) writeToStorage(activeTournamentId, activeMap);
  return removed;
}

/**
 * Reset state when leaving a tournament. Does not delete localStorage —
 * the next `loadCrowdsourcedScores` for the same id picks up where we
 * left off (modulo TTL pruning).
 */
export function clearActiveCrowdsourcedScores(): void {
  activeTournamentId = undefined;
  activeMap = new Map();
}

/**
 * Test-only: replace the active map wholesale.
 */
export function _resetCrowdsourcedScoresForTest(
  tournamentId?: string,
  entries: Array<[string, Entry]> = [],
): void {
  activeTournamentId = tournamentId;
  activeMap = new Map(entries);
}
