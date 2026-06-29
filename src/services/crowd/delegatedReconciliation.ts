/**
 * delegatedReconciliation — a small synchronous index of matchUps awaiting
 * delegated-outcome reconciliation, mirroring the crowdsourced-score index.
 *
 * A completed matchUp that still carries a `delegatedOutcome` whose scorekeeper
 * is NOT a tournament participant/official needs the TD's final sign-off. The
 * index is recomputed whenever the matchUps table builds its data; the score
 * formatter checks it per cell to render the reconciliation badge.
 */

import { matchUpDelegationIssue } from 'services/crowd/delegatedOutcome';

let reconciliationIds = new Set<string>();

/** Recompute which matchUps are awaiting delegated-outcome reconciliation. */
export function refreshReconciliationIndex(matchUps: any[], participants: any[]): void {
  const next = new Set<string>();
  for (const matchUp of matchUps ?? []) {
    if (matchUp?.matchUpId && matchUpDelegationIssue(matchUp, participants ?? [])) {
      next.add(matchUp.matchUpId);
    }
  }
  reconciliationIds = next;
}

export function isMatchUpAwaitingReconciliation(matchUpId: string | undefined): boolean {
  return !!matchUpId && reconciliationIds.has(matchUpId);
}
