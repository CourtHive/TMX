/**
 * Schedule2 — the order catalog cards are listed in.
 *
 * The question a director answers while scanning a group of cards is *which of these do I call
 * next?* The rest badge answers it card by card; this answers it for the group, so the card to call
 * is at the top instead of somewhere the eye has to find it.
 *
 *   1. Readiness, from the same rest evaluation the badge draws: every participant recovered (or
 *      with no match today) first, then those still recovering by how soon they will be ready, then
 *      cards with a participant still on court.
 *   2. Structural order — roundNumber, then roundPosition — for cards readiness cannot separate.
 *   3. The incoming (factory traversal) order, via a stable sort.
 *
 * `matchUpId` is never a key. It is a UUID: ordering by it is ordering at random, and that is what
 * both panels did before this existed — a 27m-rested card listed above three ready ones because
 * its id happened to sort first.
 *
 * ── Sorted on rebuild, never on the tick ──
 *
 * Rest counts up, and the badges repaint in place every 30 seconds. The order does not follow them:
 * re-sorting on the tick would move cards under the operator's cursor and out from under an
 * in-flight drag. Callers order once, when the catalog is rebuilt for some other reason (a mutation,
 * a filter, a date change), so between rebuilds the order can lag the badges by a band. A stale
 * order is a mild inconvenience; a card that jumps as it is grabbed is a mis-drop.
 */

import { headlineRow } from './restBadge';

// constants and types
import type { RestResult } from 'tods-competition-factory';

/** Ready to call, still recovering, still on court. Lower is listed first. */
export const READY = 0;
export const RECOVERING = 1;
export const ON_COURT = 2;

export interface ReadinessKey {
  band: number;
  /** Minutes until the slowest participant on the card is recovered; 0 outside `RECOVERING`. */
  shortfall: number;
}

/**
 * A matchUp's place in the readiness order, from its rest evaluation.
 *
 * Decided by the badge's headline row — the worst participant on the card — so the order and the
 * badge cannot disagree about a card. An unevaluated matchUp sorts with the ready ones: nothing is
 * known that says to wait for it, and placing it is not a claim about it the way a badge would be.
 * A side not yet decided reads as on court (whoever arrives is still playing upstream), which is
 * where the factory bands it.
 */
export function readinessKey(result: RestResult): ReadinessKey {
  if (!result.evaluated) return { band: READY, shortfall: 0 };
  const row = headlineRow(result.rows);
  if (!row || row.status === 'rested' || row.status === 'none') return { band: READY, shortfall: 0 };
  if (row.status === 'onCourt') return { band: ON_COURT, shortfall: 0 };
  // An unreliable anchor reports zero rest; treat the whole requirement as outstanding rather than
  // reading the arithmetic zero as "just walked off" or as recovered.
  const rested = row.anchorUnreliable ? 0 : (row.restMinutes ?? 0);
  return { band: RECOVERING, shortfall: Math.max(row.requiredMinutes - rested, 0) };
}

/** The fields ordering reads off a matchUp. Structural, so hydrated factory matchUps pass directly. */
export interface OrderableMatchUp {
  matchUpId: string;
  roundNumber?: number;
  roundPosition?: number;
  schedule?: { scheduledTime?: string } | null;
}

export interface OrderOptions {
  /**
   * Order by scheduled time ahead of readiness. For the Scheduled panel, whose cards carry the time
   * they were placed at: readiness separates cards at the same time, it does not reorder the day.
   */
  byTime?: (matchUp: OrderableMatchUp) => number;
}

/** `undefined` (no round, no position) sorts after any real value. */
function ascending(a: number | undefined, b: number | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a - b;
}

/** Draw order: roundNumber, then roundPosition. For an `Array.sort`, which keeps ties in input order. */
export function compareStructure(a: OrderableMatchUp, b: OrderableMatchUp): number {
  return ascending(a.roundNumber, b.roundNumber) || ascending(a.roundPosition, b.roundPosition);
}

/**
 * A new array of `matchUps` in catalog order. `evaluate` is the rest evaluation for one matchUp —
 * callers pass the render pass's evaluator so the order and the badges share one reading of the clock.
 */
export function orderByReadiness<T extends OrderableMatchUp>(
  matchUps: T[],
  evaluate: (matchUpId: string) => RestResult,
  options: OrderOptions = {},
): T[] {
  return matchUps
    .map((matchUp, index) => ({
      matchUp,
      index,
      time: options.byTime?.(matchUp) ?? 0,
      key: readinessKey(evaluate(matchUp.matchUpId)),
    }))
    .sort(
      (a, b) =>
        (a.time === b.time ? 0 : a.time - b.time) ||
        a.key.band - b.key.band ||
        a.key.shortfall - b.key.shortfall ||
        compareStructure(a.matchUp, b.matchUp) ||
        a.index - b.index,
    )
    .map((entry) => entry.matchUp);
}
