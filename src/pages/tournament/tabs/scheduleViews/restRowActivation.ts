/**
 * Schedule2 — what a rest row does when it is clicked.
 *
 * Two rows in the rest section look alike and mean different things, and the
 * difference decides what "point at it" can possibly mean:
 *
 *   - a row for a **person** names a participant. The useful answer to "how long
 *     have they had off" is *where else are they today*, so it drives the court
 *     grid's search box and lights up every cell that name appears in;
 *   - a row for an **undecided side** names a matchUp — `Winner of R16: Brik/Michel
 *     vs Carrasco/De L' Herbe`. There is no participant to search for; the useful
 *     answer is *which match decides this side*, and the row already knows, because
 *     `fromMatchUpId` is the feeder it was built from.
 *
 * Driving the search with a pending row's name would highlight nothing while
 * looking like it should, which is why those rows were inert. Pointing at the
 * feeder is the same gesture answering the question the row actually raises.
 *
 * Pure and DOM-free so the decision is unit-testable: TMX runs vitest without a
 * document, and the two impure halves — reading whether the grid is mounted, and
 * carrying the activation out — live in `inspectorRest` and `locateMatchUp`.
 */

// constants and types
import type { RestRow } from './participantRest';

/**
 * What clicking a row should do. `null` is a real answer and the common one on the
 * plan and profile views: with no court grid on screen there is nothing to point
 * at, and an affordance that silently does nothing is worse than no affordance.
 */
export type RestRowActivation = { kind: 'search'; participantName: string } | { kind: 'locate'; matchUpId: string };

/**
 * The activation for one row, or `null` when the row must stay inert.
 *
 * `gridMounted` is passed in rather than read: it is the one fact this decision
 * needs from the live page, and taking it as an argument is what keeps the rule
 * testable without a DOM.
 */
export function restRowActivation(row: RestRow, gridMounted: boolean): RestRowActivation | null {
  if (!gridMounted) return null;
  // A pending row is checked FIRST and never falls through to the search branch:
  // its `participantName` is populated — with a matchUp label — so an order that
  // tested the name first would hand the grid search a string no cell carries.
  if (row.pendingUpstream) {
    return row.fromMatchUpId ? { kind: 'locate', matchUpId: row.fromMatchUpId } : null;
  }
  return row.participantName ? { kind: 'search', participantName: row.participantName } : null;
}
