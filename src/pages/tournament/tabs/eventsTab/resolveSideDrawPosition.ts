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
 * `unresolved` reports the case the fallback used to paper over: a click whose side cannot be
 * identified (an unparsable `sideNumber`, or a matchUp whose `sides` do not carry one). The caller
 * surfaces it rather than proceeding on a guess.
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
  const resolvedSide = side ?? matchUp?.sides?.find((candidate: any) => candidate?.sideNumber === sideNumber);

  if (!resolvedSide) return { drawPosition: undefined, unresolved: true };

  return { drawPosition: resolvedSide.drawPosition, unresolved: false };
}
