/**
 * Live-tracked scores — remembers which matchUps received a live score frame
 * via the relay's `/live` namespace (`scoreRelay.ts`), AND the last score that
 * frame carried, so the operator sees how far along an unofficial match is in
 * tables and brackets rather than only that "something" is being tracked.
 *
 * "Live-tracked" is the `/tracker` → `/live` path (epixodic, IONSport). It is
 * NOT crowd scoring: crowd sessions live in the relay's `/crowd` store and are
 * indexed by `services/crowd/crowdActivityIndex`.
 *
 * Storage: in-memory Map<matchUpId, Entry> + localStorage per tournament
 * (`liveTrackedScores:<tournamentId>` → JSON object), so a reload still shows
 * the last known score until the next frame arrives.
 *
 * Cleanup is two-tiered:
 *   1. TTL — entries older than `TTL_MS` are dropped at load time.
 *   2. Completion — `pruneCompletedMatchUps(ids)` drops any matchUp the
 *      caller indicates has finished. TMX calls this after tournament
 *      load and after relay events propagate, using the engine's
 *      authoritative `winningSide` / completed-status check to decide.
 */

const STORAGE_PREFIX = 'liveTrackedScores:';
const TTL_MS = 24 * 60 * 60 * 1000;

const SET_FIELDS = [
  'setNumber',
  'side1Score',
  'side2Score',
  'side1TiebreakScore',
  'side2TiebreakScore',
  'side1PointScore',
  'side2PointScore',
  'winningSide',
] as const;

export interface LiveSet {
  setNumber?: number;
  side1Score?: number;
  side2Score?: number;
  side1TiebreakScore?: number;
  side2TiebreakScore?: number;
  side1PointScore?: number | string;
  side2PointScore?: number | string;
  winningSide?: number;
}

export interface LiveScore {
  sets: LiveSet[];
  scoreStringSide1?: string;
  scoreStringSide2?: string;
}

export interface LiveTrackedEntry {
  lastSeenAt: string;
  score?: LiveScore;
  matchUpStatus?: string;
  winningSide?: number;
}

let activeTournamentId: string | undefined;
let activeMap: Map<string, LiveTrackedEntry> = new Map();

function storageKey(tournamentId: string): string {
  return `${STORAGE_PREFIX}${tournamentId}`;
}

function now(): Date {
  return new Date();
}

function isExpired(entry: LiveTrackedEntry, asOf: Date): boolean {
  const t = Date.parse(entry.lastSeenAt);
  if (Number.isNaN(t)) return true;
  return asOf.getTime() - t > TTL_MS;
}

function sanitizeSet(raw: any): LiveSet | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const set: any = {};
  for (const field of SET_FIELDS) {
    const value = raw[field];
    if (typeof value === 'number' || (typeof value === 'string' && field.endsWith('PointScore'))) set[field] = value;
  }
  return set;
}

/** Keep only the score fields a display needs; a relay frame is untrusted input. */
export function sanitizeLiveScore(raw: any): LiveScore | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const sets = Array.isArray(raw.sets) ? raw.sets.map(sanitizeSet).filter(Boolean) : [];
  const score: LiveScore = { sets };
  if (typeof raw.scoreStringSide1 === 'string') score.scoreStringSide1 = raw.scoreStringSide1;
  if (typeof raw.scoreStringSide2 === 'string') score.scoreStringSide2 = raw.scoreStringSide2;
  if (!sets.length && !score.scoreStringSide1) return undefined;
  return score;
}

function parseEntry(value: any): LiveTrackedEntry | undefined {
  if (!value || typeof value !== 'object') return undefined;
  if (typeof value.lastSeenAt !== 'string') return undefined;
  const entry: LiveTrackedEntry = { lastSeenAt: value.lastSeenAt };
  const score = sanitizeLiveScore(value.score);
  if (score) entry.score = score;
  if (typeof value.matchUpStatus === 'string') entry.matchUpStatus = value.matchUpStatus;
  if (typeof value.winningSide === 'number') entry.winningSide = value.winningSide;
  return entry;
}

function readFromStorage(tournamentId: string): Map<string, LiveTrackedEntry> {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey(tournamentId));
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return new Map();
    const result = new Map<string, LiveTrackedEntry>();
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof id !== 'string' || !id) continue;
      const entry = parseEntry(value);
      if (entry) result.set(id, entry);
    }
    return result;
  } catch {
    return new Map();
  }
}

function writeToStorage(tournamentId: string, map: Map<string, LiveTrackedEntry>): void {
  try {
    if (map.size === 0) {
      globalThis.localStorage?.removeItem(storageKey(tournamentId));
      return;
    }
    const obj: Record<string, LiveTrackedEntry> = {};
    for (const [id, entry] of map) obj[id] = entry;
    globalThis.localStorage?.setItem(storageKey(tournamentId), JSON.stringify(obj));
  } catch {
    // localStorage unavailable / quota exceeded — keep the in-memory map as truth.
  }
}

function pruneExpired(map: Map<string, LiveTrackedEntry>, asOf: Date): boolean {
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
export function loadLiveTrackedScores(tournamentId: string): void {
  activeTournamentId = tournamentId;
  activeMap = readFromStorage(tournamentId);
  if (pruneExpired(activeMap, now())) {
    writeToStorage(tournamentId, activeMap);
  }
}

/**
 * Record a relay score frame for this matchUp. Refreshes `lastSeenAt` on every
 * call so an actively-tracked matchUp keeps its 24-hour countdown rolling
 * forward, and keeps the frame's score — a frame without one (a clock-only
 * update) leaves the previous score in place. Writes through to localStorage.
 */
export function recordLiveTrackedScore(matchUpId: string | undefined, frame?: any): void {
  if (!matchUpId || !activeTournamentId) return;
  const previous = activeMap.get(matchUpId);
  const entry: LiveTrackedEntry = { lastSeenAt: now().toISOString() };
  const score = sanitizeLiveScore(frame?.score) ?? previous?.score;
  if (score) entry.score = score;
  const matchUpStatus = typeof frame?.matchUpStatus === 'string' ? frame.matchUpStatus : previous?.matchUpStatus;
  if (matchUpStatus) entry.matchUpStatus = matchUpStatus;
  const winningSide = typeof frame?.winningSide === 'number' ? frame.winningSide : previous?.winningSide;
  if (winningSide) entry.winningSide = winningSide;
  activeMap.set(matchUpId, entry);
  writeToStorage(activeTournamentId, activeMap);
}

/**
 * Returns true if a live score frame has arrived for the matchUp in the
 * currently-loaded tournament. Cheap — backed by an in-memory Map.
 */
export function isMatchUpLiveTracked(matchUpId: string | undefined): boolean {
  if (!matchUpId) return false;
  return activeMap.has(matchUpId);
}

/** The last live score frame recorded for the matchUp, if any. */
export function getLiveTrackedScore(matchUpId: string | undefined): LiveTrackedEntry | undefined {
  if (!matchUpId) return undefined;
  return activeMap.get(matchUpId);
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
 * the next `loadLiveTrackedScores` for the same id picks up where we
 * left off (modulo TTL pruning).
 */
export function clearActiveLiveTrackedScores(): void {
  activeTournamentId = undefined;
  activeMap = new Map();
}

/**
 * Test-only: replace the active map wholesale.
 */
export function _resetLiveTrackedScoresForTest(
  tournamentId?: string,
  entries: Array<[string, LiveTrackedEntry]> = [],
): void {
  activeTournamentId = tournamentId;
  activeMap = new Map(entries);
}
