import { matchUpStatusConstants } from 'tods-competition-factory';

const { COMPLETED } = matchUpStatusConstants;

/**
 * Whether a matchUp's result is in: it has a winner, or it is COMPLETED. A combined-point total that allows a
 * tie (SET1-S:P32) can end 16-16, COMPLETED with no winner (CA, 2026-10-11: ties are valid), so "has a winner"
 * alone reads a finished tie as still to play. Only a tie is COMPLETED without a winner; every other status
 * (the double exits, ABANDONED, …) is judged as it was.
 */
export function hasFinalResult(matchUp: { winningSide?: number; matchUpStatus?: string } | undefined): boolean {
  return !!matchUp?.winningSide || matchUp?.matchUpStatus === COMPLETED;
}
