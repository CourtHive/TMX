/**
 * Whether a recorded outcome can be REMOVED, as the factory decides it.
 *
 * Clearing is submitted through the same `setMatchUpStatus` as scoring, with an empty outcome, so the
 * dialog's `[Clear]` then `[Submit]` used to go to the engine and come back refused with "No valid
 * actions" when a later match depended on the result: the director learned it by being told no, in
 * words that did not say why. The factory publishes the answer in advance as the `CLEAR_SCORE` matchUp
 * action (#4795(factory)), present only when a clear would succeed. These read it; nothing here
 * re-derives the rule.
 */
import { tournamentEngine } from 'services/factory/engine';

const CLEAR_SCORE = 'CLEAR_SCORE';
const TO_BE_PLAYED = 'TO_BE_PLAYED';

/** True when the matchUp holds an outcome a clear would remove — the factory's own test. */
function holdsOutcome(matchUp: any): boolean {
  return !!matchUp?.winningSide || (!!matchUp?.matchUpStatus && matchUp.matchUpStatus !== TO_BE_PLAYED);
}

/**
 * Whether clearing this matchUp's outcome would be accepted.
 *
 * True when there is nothing to remove (a blank submission is not a clear, and is not refused for being
 * one), or when the factory offers `CLEAR_SCORE`. When the actions cannot be read at all, true: the
 * engine still refuses a bad clear, so the cost of not knowing is the old behaviour, not a lost result.
 */
export function clearPermitted({ matchUp, drawId, matchUpId }: { matchUp: any; drawId?: string; matchUpId?: string }) {
  if (!holdsOutcome(matchUp)) return true;
  const result: any = tournamentEngine.matchUpActions({
    drawId: drawId ?? matchUp?.drawId,
    matchUpId: matchUpId ?? matchUp?.matchUpId,
  });
  if (!Array.isArray(result?.validActions)) return true;
  return result.validActions.some(({ type }: any) => type === CLEAR_SCORE);
}

/**
 * Whether an engine-ready outcome REMOVES the recorded result: no winner, no sets, and no status other
 * than "to be played". Both score dialogs reduce a clear to this shape (`{ score: { sets: [] } }`);
 * an irregular ending without a winner (ABANDONED, CANCELLED, …) carries its status and is not a clear.
 */
export function isClearingOutcome(outcome: any): boolean {
  if (!outcome || outcome.winningSide) return false;
  if (outcome.score?.sets?.length || outcome.sets?.length) return false;
  return !outcome.matchUpStatus || outcome.matchUpStatus === TO_BE_PLAYED;
}
