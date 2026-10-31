/**
 * Order of finish for a TEAM dual's lines: the order each completed line finished among the dual's lines of the same
 * matchUpType (the factory's cohort for `setOrderOfFinish`: same structure, round, matchUpType and dual). The StatCrew
 * export reads it.
 *
 * A line completed from the scorecard finishes after the cohort's other completed lines; the Order of finish modal
 * corrects the order. The factory does not clear `orderOfFinish` when a line's score is cleared, so a line that is no
 * longer complete can still carry a number: everything here counts completed lines only, and a line completed again
 * goes to the end.
 *
 * Lives in its own module so it can be tested without importing the overlay, which pulls courthive-components.
 */
import { completedMatchUpStatuses } from 'tods-competition-factory';
import { SET_ORDER_OF_FINISH } from 'constants/mutationConstants';

export type OrderOfFinishCohort = { matchUpType: string; matchUps: any[] };

const isCompleted = (matchUp: any) => completedMatchUpStatuses.includes(matchUp?.matchUpStatus);

/** The dual's completed lines by matchUpType, each cohort ordered by its current order of finish, then by position. */
export function orderOfFinishCohorts(dual: any): OrderOfFinishCohort[] {
  const byType = new Map<string, any[]>();
  for (const matchUp of (dual?.tieMatchUps ?? []).filter(isCompleted)) {
    const cohort = byType.get(matchUp.matchUpType) ?? [];
    cohort.push(matchUp);
    byType.set(matchUp.matchUpType, cohort);
  }
  const rank = (matchUp: any) => matchUp.orderOfFinish ?? Number.MAX_SAFE_INTEGER;
  return [...byType.entries()].map(([matchUpType, matchUps]) => ({
    matchUps: matchUps.sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (a.collectionPosition ?? 0) - (b.collectionPosition ?? 0) ||
        String(a.collectionId).localeCompare(String(b.collectionId)),
    ),
    matchUpType,
  }));
}

/**
 * The method numbering a line that has just been completed: it finishes after the other completed lines of its cohort.
 * The whole cohort is renumbered 1..n in its current order, since the factory requires a cohort's numbers to be
 * unique and no greater than its count; a cleared line leaves a gap that this closes. Nothing when the line is not
 * complete, or was already complete before (a score edit keeps its place).
 */
export function completedLineOrderMethod({
  wasCompleted,
  matchUpId,
  dual,
}: {
  wasCompleted: boolean;
  matchUpId: string;
  dual: any;
}): any | undefined {
  const line = (dual?.tieMatchUps ?? []).find((matchUp: any) => matchUp.matchUpId === matchUpId);
  if (!line || wasCompleted || !isCompleted(line)) return undefined;

  const cohort = orderOfFinishCohorts(dual).find(({ matchUpType }) => matchUpType === line.matchUpType);
  const others = (cohort?.matchUps ?? []).map(({ matchUpId }) => matchUpId).filter((id) => id !== matchUpId);
  return finishingOrderMethods({ drawId: dual.drawId, orderedCohorts: [[...others, matchUpId]] })[0];
}

/** One method per cohort, numbering its lines 1..n in the given order. */
export function finishingOrderMethods({ drawId, orderedCohorts }: { drawId: string; orderedCohorts: string[][] }) {
  return orderedCohorts
    .filter((matchUpIds) => matchUpIds.length)
    .map((matchUpIds) => ({
      method: SET_ORDER_OF_FINISH,
      params: {
        finishingOrder: matchUpIds.map((matchUpId, index) => ({ orderOfFinish: index + 1, matchUpId })),
        drawId,
      },
    }));
}

/** Whether a cohort's chosen numbers are each used once and run 1..n. */
export function isValidFinishingOrder(numbers: number[]): boolean {
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted.every((value, index) => value === index + 1);
}
