import { onTournamentContextChanged } from 'services/tournament/tournamentContextObservers';
import { readCompetitionDateRange, readTournamentInfo } from 'services/factory/passReads';
import { onMutationApplied } from 'services/mutation/mutationObservers';
import { competitionEngine } from 'services/factory/engine';
import { dropPassValues } from 'functions/renderPass';
import { unwrapOr } from 'tods-competition-factory';

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
 *  - `competitionDateRange` and `tournamentInfo` — cached across reads, invalidated
 *    with matchUps after acknowledged writes and full record reloads. Remote metadata
 *    changes can arrive without navigation. Tournament switches and schedule-tab teardown
 *    also drop the complete cache (`invalidateAllScheduleCaches`).
 *
 * Variance-tolerant caching: callers pass different param shapes
 * (`{inContext: true, nextMatchUps: true}` vs `{inContext: true}` alone;
 * `competitionScheduleMatchUps` with or without `courtCompletedMatchUps`).
 * We cache the most-inclusive variant — extra fields are additive and
 * harmless to consumers that don't read them.
 */

let allMatchUpsCache: any = null;
let matchUpByIdCache: Map<string, any> | null = null;
const scheduleMatchUpsByKey = new Map<string, any>();
const proConflictsByDate = new Map<string, any>();
let competitionDateRangeCache: any = null;
let tournamentInfoCache: any = null;

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

/** The cached `inContext` matchUps by id, so a per-card lookup is not a scan of every matchUp. */
export function getCachedMatchUpById(): Map<string, any> {
  matchUpByIdCache ??= new Map((getCachedAllMatchUps().matchUps ?? []).map((m: any) => [m.matchUpId, m]));
  return matchUpByIdCache;
}

/**
 * `proConflicts` over the matchUps placed on a court on `scheduledDate`, with those matchUps.
 * `evaluated` is false when there were none, or when `proConflicts` refused.
 *
 * The header/row indicators, the issues list and the column-conflict resolver all asked the same
 * question of the same input, so a render ran it three times; each run walks every draw's
 * dependencies. Lives and dies with `allMatchUps`, which is its input.
 */
export function getCachedProConflicts(scheduledDate: string): any {
  if (proConflictsByDate.has(scheduledDate)) return proConflictsByDate.get(scheduledDate);
  const scheduledMatchUps = (getCachedAllMatchUps().matchUps ?? []).filter(
    (m: any) => m.schedule?.courtId && m.schedule?.scheduledDate === scheduledDate,
  );
  const result = scheduledMatchUps.length
    ? unwrapOr(competitionEngine.proConflicts({ matchUps: scheduledMatchUps }), null)
    : null;
  const entry = { ...result, scheduledMatchUps, evaluated: !!result };
  proConflictsByDate.set(scheduledDate, entry);
  return entry;
}

export function getCachedScheduleMatchUps(scheduledDate: string, params: ScheduleMatchUpsParams = {}): any {
  const minRows = params.minCourtGridRows ?? 0;
  const key = `${scheduledDate}|${minRows}`;
  let entry = scheduleMatchUpsByKey.get(key);
  if (!entry) {
    entry = competitionEngine.competitionScheduleMatchUps({
      matchUpFilters: { scheduledDate },
      courtCompletedMatchUps: true,
      // A BYE that HOLDS A COURT gets a cell. Assigning a BYE deliberately preserves
      // scheduling — a director may be mid-swap — so the slot really is taken, and
      // hiding it is what produced the phantom `courtDoubleBooking` reported on
      // 2026-08-22: an invisible occupant the operator then placed a match over.
      // Court-holders only; a date/time-only BYE occupies no cell.
      courtByeMatchUps: true,
      withCourtGridRows: true,
      minCourtGridRows: params.minCourtGridRows,
    });
    scheduleMatchUpsByKey.set(key, entry);
  }
  return entry;
}

// Filled through the pass reads (passReads), so the render that resolves the schedule date (scheduleUtils) and
// the header/grid reading these share one factory call; the cache then keeps the value for the mount.
export function getCachedCompetitionDateRange(): any {
  competitionDateRangeCache ??= readCompetitionDateRange();
  return competitionDateRangeCache;
}

export function getCachedTournamentInfo(): any {
  tournamentInfoCache ??= readTournamentInfo();
  return tournamentInfoCache;
}

/**
 * Invalidate after any matchUp / court / venue mutation. Tournament-level
 * metadata (date range, tournamentInfo) has a separate full invalidation path.
 */
export function invalidateMatchUpCaches(): void {
  allMatchUpsCache = null;
  matchUpByIdCache = null;
  scheduleMatchUpsByKey.clear();
  proConflictsByDate.clear();
}

/**
 * Full invalidation — clears every cached entry. Called when the schedule2
 * tab tears down (so a stale cache from one mount can't leak into the
 * next) and when the user navigates between tournaments.
 */
export function invalidateAllScheduleCaches(): void {
  // The date range and tournament info fill through pass reads; a reset must not be answered by a
  // pass value read earlier in the same task.
  dropPassValues();
  invalidateMatchUpCaches();
  competitionDateRangeCache = null;
  tournamentInfoCache = null;
}

// Self-maintaining freshness: any mutation routed through mutationRequest
// (the central client mutation path) drops the matchUp caches so the next
// schedule read pulls fresh truth. This is what makes score entry from the
// scoring modal — which calls mutationRequest directly rather than the
// schedule's executeMethods — reflect immediately on the grid. Tournament
// metadata caches are also dropped: remote edits and full reloads do not require navigation.
// A module-scoped subscription is fine: when schedule2 isn't mounted the
// caches are already empty, so the clear is a cheap no-op.
onMutationApplied(invalidateAllScheduleCaches);

// Self-healing across tournament switches: the loader fires
// notifyTournamentContextChanged when the active tournament changes (only then,
// not on intra-tournament navigation), so drop the whole cache — the previous
// tournament's date range / tournamentInfo / matchUps must not leak into the
// next. Mirrors the onMutationApplied subscription above; replaces the old
// caller-driven syncTournamentContext, which every schedule surface had to
// remember to call (and the workspace didn't).
onTournamentContextChanged(invalidateAllScheduleCaches);
