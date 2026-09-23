/**
 * The drawPosition a clicked side owns — by `sideNumber`, never by array index.
 *
 * `matchUp.drawPositions` is a bare ARRAY and the decision that it stays one is closed
 * (`Mentat/planning/DRAWPOSITIONS_AS_AN_OBJECT_ECOSYSTEM_AUDIT.md`). The array's INDEX is not a side
 * number: it is COMPACTED when a matchUp holds one position — a produced exit waiting for its
 * opponent — so `drawPositions[sideNumber - 1]` silently returns another side's position, or
 * `undefined`, exactly when it matters.
 *
 * This replaces `side?.drawPosition || (sideNumber && matchUp.drawPositions?.[sideNumber - 1])`,
 * whose fallback guessed in silence. Measured before removing it (2026-09-23, instrumented build,
 * three draw shapes — SINGLE_ELIMINATION with a produced exit in flight, FIRST_MATCH_LOSER_CONSOLATION
 * with one, and an 8-draw with BYEs): **42 side clicks, 0 fires**. The same instrumentation made
 * unconditional fired on every reachable click, so the zero is an absence, not dead instrumentation.
 *
 * ORDER IS A LAST RESORT FOR THE SIDE, NEVER FOR THE POSITION. `getEventData` returns future-round
 * matchUps whose sides are EMPTY OBJECTS — measured 2026-09-23: of 7 matchUps in an 8 draw, 3 carry
 * sides with no `sideNumber`, no `drawPosition` and no participant, and no `drawPositions` array at
 * all. Clicking one is an ordinary interaction with genuinely nothing to resolve. So when no side
 * names itself, the side at that ORDINAL is used — the factory builds `sides` from ordered positions
 * — which yields the same `undefined` drawPosition the old code produced, without inventing one.
 *
 * `unresolved` is therefore reserved for a matchUp with no side there at all, which is a real
 * anomaly worth surfacing rather than the everyday empty slot.
 */
export function resolveSideDrawPosition({
  sideNumber,
  matchUp,
  side,
}: {
  sideNumber?: number;
  matchUp?: any;
  side?: any;
}): { drawPosition?: number; unresolved: boolean } {
  const sides = matchUp?.sides ?? [];
  const named = sides.find((candidate: any) => candidate?.sideNumber === sideNumber);
  const byOrdinal = sideNumber === 1 || sideNumber === 2 ? sides[sideNumber - 1] : undefined;
  const resolvedSide = side ?? named ?? byOrdinal;

  if (!resolvedSide) return { drawPosition: undefined, unresolved: true };

  return { drawPosition: resolvedSide.drawPosition, unresolved: false };
}
