import { onMutationApplied } from 'services/mutation/mutationObservers';
import { competitionEngine } from 'services/factory/engine';

/**
 * Page-scoped factory-call cache for the schedule2 surface.
 *
 * Before this cache: a single date change ran ~8 `allTournamentMatchUps`,
 * 2 `competitionScheduleMatchUps`, 3 `proConflicts`, and 3 each of
 * `getCompetitionDateRange` / `getTournamentInfo` calls — the bulk of the
 * duplication came from the schedule-page store's subscription firing once
 * per `setX()` write (catalog, dates, issues), and each subscriber re-
 * pulling matchUps from the factory.
 *
 * This module memoizes those calls across the render and the cascading
 * subscriber fires, then drops the cache when state changes. Two
 * lifetimes:
 *
 *  - `allMatchUps` and `scheduleMatchUps(date)` — invalidated on every
 *    mutation (anything routed through `executeMethods`), because matchUp
 *    state and court placement can change.
 *  - `competitionDateRange` and `tournamentInfo` — page-scoped. The schedule
 *    page itself never edits these; a full reset happens on return to the
 *    tournaments list (`invalidateAllScheduleCaches` in tournaments.ts).
 *
 * Variance-tolerant caching: callers pass different param shapes
 * (`{inContext: true, nextMatchUps: true}` vs `{inContext: true}` alone;
 * `competitionScheduleMatchUps` with or without `courtCompletedMatchUps`).
 * We cache the most-inclusive variant — extra fields are additive and
 * harmless to consumers that don't read them.
 */

let allMatchUpsCache: any = null;
const scheduleMatchUpsByKey = new Map<string, any>();
let competitionDateRangeCache: any = null;
let tournamentInfoCache: any = null;
let lastTournamentId: string | null = null;

interface ScheduleMatchUpsParams {
  minCourtGridRows?: number;
}

export function getCachedAllMatchUps(): any {
  allMatchUpsCache ??= competitionEngine.allTournamentMatchUps({
    inContext: true,
    nextMatchUps: true,
  });
  return allMatchUpsCache;
}

export function getCachedScheduleMatchUps(
  scheduledDate: string,
  params: ScheduleMatchUpsParams = {},
): any {
  const minRows = params.minCourtGridRows ?? 0;
  const key = `${scheduledDate}|${minRows}`;
  let entry = scheduleMatchUpsByKey.get(key);
  if (!entry) {
    entry = competitionEngine.competitionScheduleMatchUps({
      matchUpFilters: { scheduledDate },
      courtCompletedMatchUps: true,
      withCourtGridRows: true,
      minCourtGridRows: params.minCourtGridRows,
    });
    scheduleMatchUpsByKey.set(key, entry);
  }
  return entry;
}

export function getCachedCompetitionDateRange(): any {
  competitionDateRangeCache ??= competitionEngine.getCompetitionDateRange();
  return competitionDateRangeCache;
}

export function getCachedTournamentInfo(): any {
  tournamentInfoCache ??= competitionEngine.getTournamentInfo();
  return tournamentInfoCache;
}

/**
 * Invalidate after any matchUp / court / venue mutation. Tournament-level
 * metadata (date range, tournamentInfo) is NOT cleared here because edits
 * to those flow through navigations that re-enter the page.
 */
export function invalidateMatchUpCaches(): void {
  allMatchUpsCache = null;
  scheduleMatchUpsByKey.clear();
}

/**
 * Full invalidation — clears every cached entry. Called when the schedule2
 * tab tears down (so a stale cache from one mount can't leak into the
 * next) and when the user navigates between tournaments.
 */
export function invalidateAllScheduleCaches(): void {
  invalidateMatchUpCaches();
  competitionDateRangeCache = null;
  tournamentInfoCache = null;
}

// Self-maintaining freshness: any mutation routed through mutationRequest
// (the central client mutation path) drops the matchUp caches so the next
// schedule read pulls fresh truth. This is what makes score entry from the
// scoring modal — which calls mutationRequest directly rather than the
// schedule's executeMethods — reflect immediately on the grid. Tournament
// metadata caches are intentionally left intact (see invalidateMatchUpCaches).
// A module-scoped subscription is fine: when schedule2 isn't mounted the
// caches are already empty, so the clear is a cheap no-op.
onMutationApplied(invalidateMatchUpCaches);

/**
 * Track tournament identity so the cache survives intra-tournament
 * navigations (date change, view switch) but resets cleanly on cross-
 * tournament transitions. Call before reading any cached value on a surface
 * that can switch tournaments in place.
 *
 * NOTE: no production caller since the `/schedule2` shell was retired — the
 * scheduling workspace resets its schedule caches via the tournaments-list
 * `invalidateAllScheduleCaches`. Retained (with test coverage) for reuse if an
 * in-place tournament switch is ever added to the workspace.
 */
export function syncTournamentContext(tournamentId: string): void {
  if (lastTournamentId !== tournamentId) {
    invalidateAllScheduleCaches();
    lastTournamentId = tournamentId;
  }
}
