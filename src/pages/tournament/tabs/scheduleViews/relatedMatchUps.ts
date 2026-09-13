/**
 * Schedule2 — which matchUps a card is entangled with.
 *
 * Hovering a catalog card lights these up wherever the page draws them, so the
 * question the card raises — *why is this 14:30 red?* — is answered by pointing
 * at the grid rather than by reading a sentence about it.
 *
 * ── The relation, and why it is not the grid's ──
 *
 * The court grid already highlights on hover, driven by `issueIds` from
 * `proConflicts` (`scheduleGridCell.ts`). That relation is unavailable here twice
 * over: a `CatalogMatchUpItem` does not carry `issueIds`, and an *unscheduled*
 * matchUp cannot have a conflict at all — which is most of the catalog, and
 * exactly the cards a director is deciding about.
 *
 * What a card does have is already computed for it:
 *
 *   - readiness findings carry `matchUpIds` — the upstream feeder it is waiting
 *     on, the matchUp a player is on court in, the one they are recovering from
 *   - rest rows carry `fromMatchUpId` — where each player's day has been
 *
 * Together those are "everything this matchUp is waiting on or has just come out
 * of", which is the honest meaning of *related* for a card. Readiness first: a
 * blocker is a stronger relation than a player's earlier match, and the order
 * survives into the highlight set for anything that later wants to rank it.
 *
 * Pure, so it can be tested without a DOM — the impure half is two calls in
 * `gridView`, which already holds the engine-backed evaluators.
 */

// constants and types
import type { ReadinessResult } from './matchUpReadiness';
import type { RestResult } from './participantRest';

/**
 * MatchUps related to the one these results describe, strongest relation first
 * and deduped.
 *
 * Empty is a real answer, not a failure: a matchUp with clean readiness whose
 * players have not played today is related to nothing yet, and the card should
 * light nothing up rather than light up the whole day.
 */
export function relatedMatchUpIds(readiness: ReadinessResult, rest: RestResult): string[] {
  const ids: string[] = [];

  if (readiness.evaluated) {
    for (const finding of readiness.findings) ids.push(...(finding.matchUpIds ?? []));
  }
  if (rest.evaluated) {
    for (const row of rest.rows) if (row.fromMatchUpId) ids.push(row.fromMatchUpId);
  }

  return [...new Set(ids)];
}
