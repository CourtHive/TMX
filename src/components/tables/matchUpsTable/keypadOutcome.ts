import { clearPermitted, isClearingOutcome } from 'services/transitions/clearScorePermission';
import { scoreGovernor } from 'tods-competition-factory';

/** The engine-ready outcome for a score typed on the keypad (hotkey entry), as Enter submits it. */
export function keypadOutcome(typedMatchUp: any): any {
  return {
    matchUpStatus: typedMatchUp.matchUpStatus,
    winningSide: typedMatchUp.winningSide,
    score: {
      sets: typedMatchUp.sets,
      scoreStringSide1: scoreGovernor.generateScoreString({ sets: typedMatchUp.sets }),
      scoreStringSide2: scoreGovernor.generateScoreString({ sets: typedMatchUp.sets, reversed: true }),
    },
  };
}

/**
 * Whether Enter on this keypad outcome is a clear the engine would refuse (a later match depends on the result).
 *
 * Hotkey entry only takes matchUps without a final result (`takesHotkeyEntry`), but a double exit
 * (DOUBLE_WALKOVER, DOUBLE_DEFAULT) has no winner and still propagates: the next round holds a produced exit,
 * and once a later match is decided the factory withholds `CLEAR_SCORE`. Backspace to empty then Enter on that
 * field is a clear, and this is what stops it with the reason instead of sending it to come back "No valid actions".
 */
export function keypadClearRefused({ matchUp, outcome }: { matchUp: any; outcome: any }): boolean {
  return isClearingOutcome(outcome) && !clearPermitted({ matchUp });
}
