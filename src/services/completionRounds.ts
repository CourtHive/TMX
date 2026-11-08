/**
 * The rounds of one structure as the "complete matchUps" control offers them (local mode, no provider).
 *
 * "Still to play" is the factory's own reading in `completeDrawMatchUps`: no winningSide, and not settled without
 * being played (BYE, DOUBLE_WALKOVER, DOUBLE_DEFAULT, DEAD_RUBBER, ABANDONED, CANCELLED). The two must agree, because
 * the factory counts `roundsToComplete` from the structure's first round still to play — read differently here, the
 * control would complete past the round a director chose, or short of it.
 */
import { matchUpStatusConstants } from 'tods-competition-factory';

const { BYE, DOUBLE_WALKOVER, DOUBLE_DEFAULT, DEAD_RUBBER, ABANDONED, CANCELLED } = matchUpStatusConstants;
const SETTLED_STATUSES = new Set<string>([BYE, DOUBLE_WALKOVER, DOUBLE_DEFAULT, DEAD_RUBBER, ABANDONED, CANCELLED]);

export type CompletionRound = {
  roundNumber: number;
  /** the round's short name (QF, SF, F), else R{n} */
  label: string;
  matchUpsCount: number;
  /** matchUps still to play */
  openCount: number;
};

export type CompletionRounds = {
  rounds: CompletionRound[];
  /** the first round with a matchUp still to play; absent when nothing is left */
  firstOpenRound?: number;
  openCount: number;
};

type RoundMatchUp = {
  roundNumber?: number;
  winningSide?: number;
  matchUpStatus?: string;
  collectionId?: string;
  abbreviatedRoundName?: string;
};

export function isStillToPlay(matchUp: RoundMatchUp): boolean {
  return !matchUp.winningSide && !SETTLED_STATUSES.has(matchUp.matchUpStatus as string);
}

/** `matchUps`: the structure's matchUps, a round robin's across its groups. A TEAM draw's tie matchUps are skipped. */
export function completionRounds(matchUps: RoundMatchUp[]): CompletionRounds {
  const byRound = new Map<number, CompletionRound>();
  for (const matchUp of matchUps) {
    if (matchUp.collectionId || !matchUp.roundNumber) continue;
    const round = byRound.get(matchUp.roundNumber) ?? {
      label: matchUp.abbreviatedRoundName || `R${matchUp.roundNumber}`,
      roundNumber: matchUp.roundNumber,
      matchUpsCount: 0,
      openCount: 0,
    };
    round.matchUpsCount += 1;
    if (isStillToPlay(matchUp)) round.openCount += 1;
    byRound.set(matchUp.roundNumber, round);
  }

  const rounds = [...byRound.values()].sort((a, b) => a.roundNumber - b.roundNumber);
  const firstOpenRound = rounds.find((round) => round.openCount)?.roundNumber;
  const openCount = rounds.reduce((sum, round) => sum + round.openCount, 0);
  return { rounds, firstOpenRound, openCount };
}

/** The `roundsToComplete` that stops after `targetRound`; undefined when that round has nothing left to play. */
export function roundsToCompleteThrough({ firstOpenRound }: CompletionRounds, targetRound: number): number | undefined {
  if (firstOpenRound === undefined || targetRound < firstOpenRound) return undefined;
  return targetRound - firstOpenRound + 1;
}

/** The rounds a "through {target}" choice completes, and how many matchUps they hold still to play. */
export function throughRoundSpan(completion: CompletionRounds, targetRound: number): CompletionRound[] {
  const { firstOpenRound } = completion;
  if (firstOpenRound === undefined) return [];
  return completion.rounds.filter(({ roundNumber }) => roundNumber >= firstOpenRound && roundNumber <= targetRound);
}
