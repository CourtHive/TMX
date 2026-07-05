/**
 * Tournament-context change notification.
 *
 * The active tournament changes when the app loads a different tournament for
 * display — `renderTournament` (tournamentDisplay.ts) runs only on an actual
 * load/switch, not on intra-tournament navigation. Page-level caches that
 * memoize per-tournament factory reads must drop their entries when the
 * tournament switches, or a read taken for the previous tournament leaks into
 * the next one (e.g. the scheduling workspace showing tournament A's schedule
 * inside tournament B on a direct workspace→workspace navigation).
 *
 * Rather than make every load site remember to invalidate every cache — the
 * gap that let the workspace serve a stale schedule once the /schedule2 shell
 * (which happened to invalidate on its way through) was retired — the loader
 * fires `notifyTournamentContextChanged(tournamentId)` once per switch and
 * caches subscribe via `onTournamentContextChanged`. This mirrors
 * `onMutationApplied` for mutations: new caches opt in here with no load-site
 * changes, and it replaces the old caller-driven `syncTournamentContext`.
 */

type TournamentContextObserver = (tournamentId: string) => void;

const observers = new Set<TournamentContextObserver>();
let lastTournamentId: string | null = null;

/**
 * Register a callback invoked when the active tournament changes (NOT on
 * re-entry to the same tournament). Returns an unsubscribe function. Cache
 * clears are the intended use — keep the callback cheap and side-effect-free
 * beyond the cache it owns.
 */
export function onTournamentContextChanged(observer: TournamentContextObserver): () => void {
  observers.add(observer);
  return () => observers.delete(observer);
}

/**
 * Fire every registered observer when `tournamentId` differs from the last one
 * seen; idempotent for repeat calls with the same id. Called by the tournament
 * loader once the new record is in the engine. An observer that throws must not
 * prevent the others from running, so each is wrapped.
 */
export function notifyTournamentContextChanged(tournamentId: string): void {
  if (tournamentId === lastTournamentId) return;
  lastTournamentId = tournamentId;
  for (const observer of observers) {
    try {
      observer(tournamentId);
    } catch (err) {
      console.error('[tournamentContextObservers] observer threw', err);
    }
  }
}
