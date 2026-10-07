/**
 * Rounds cap for a playoff structure — the pure half of the Add playoffs modal.
 *
 * A playoff for the losers of a round is a full tree by default: 32 losers play five rounds to one
 * winner. A consolation usually plays one or two. The factory takes `roundLimits` keyed by the SOURCE
 * round number (CourtHive/competition-factory#5282); this module builds the options a range offers and
 * reads the operator's choice back into that shape. Nothing here touches the DOM.
 */
export type PlayoffRange = { finishingPositionRange: string; finishingPositions: number[]; roundNumber: number };

export const ALL_ROUNDS = '';

/** The field that carries a range's rounds cap. */
export const roundsField = (finishingPositionRange: string): string => `${finishingPositionRange}-rounds`;

/** How many rounds a structure for this many finishing positions plays through to one winner. */
export function naturalRounds(finishingPositionsCount: number): number {
  if (finishingPositionsCount < 2) return 0;
  return Math.ceil(Math.log2(finishingPositionsCount));
}

/** "All", then every cap below the natural depth; a structure with one round offers no cap. */
export function roundOptions(
  finishingPositionsCount: number,
  allLabel: string,
): { label: string; value: string; selected?: boolean }[] {
  const rounds = naturalRounds(finishingPositionsCount);
  const caps = Array.from({ length: Math.max(0, rounds - 1) }, (_, i) => String(i + 1));
  return [{ label: allLabel, value: ALL_ROUNDS, selected: true }, ...caps.map((cap) => ({ label: cap, value: cap }))];
}

/** `roundLimits` for the factory, from the checked ranges whose rounds select holds a cap. */
export function collectRoundLimits(
  checkedRanges: PlayoffRange[],
  readValue: (field: string) => string | undefined,
): { [sourceRoundNumber: number]: number } | undefined {
  const limits: { [sourceRoundNumber: number]: number } = {};
  for (const range of checkedRanges) {
    const cap = Number.parseInt(readValue(roundsField(range.finishingPositionRange)) ?? '', 10);
    if (Number.isInteger(cap) && cap >= 1 && cap < naturalRounds(range.finishingPositions.length)) {
      limits[range.roundNumber] = cap;
    }
  }
  return Object.keys(limits).length ? limits : undefined;
}
