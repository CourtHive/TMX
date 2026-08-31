import { isScorable } from 'courthive-components';

/**
 * Promote ready matchUps to IN_PROGRESS so the inline-scoring wrapper picks them up.
 *
 * Extracted from `renderDrawView` so the gate below is testable: `renderDrawView` reaches the DOM and
 * TMX has no jsdom, so a decision left inside it gets no unit coverage.
 *
 * The gate is the LIBRARY's `isScorable`, not a local approximation. Marking IN_PROGRESS is precisely
 * what makes `applyInlineScoringWrappers` pick a matchUp up, so a looser rule here promotes matchUps
 * that `renderInlineMatchUp` then refuses — a draw showing a match as in progress with no way to score
 * it. The predicate this replaced checked that both sides HAD participants, but not that they could be
 * NAMED, and never checked `matchUpFormat` at all.
 *
 * Mutates in place, matching the previous behaviour and the caller's expectation.
 */
export function markReadyMatchUpsInProgress(displayMatchUps: any[]): void {
  for (const m of displayMatchUps || []) {
    if (!isScorable(m)) continue;
    if (m?.readyToScore && !m?.winningSide && (!m?.matchUpStatus || m.matchUpStatus === 'TO_BE_PLAYED')) {
      m.matchUpStatus = 'IN_PROGRESS';
    }
  }
}
