import { mocksEngine, scoreGovernor, tournamentEngine as factoryEngine } from 'tods-competition-factory';
import { describe, expect, it, vi } from 'vitest';

// The REAL engine: the refusal reads the factory's own answer (`CLEAR_SCORE`), so a mock would only test itself.
vi.mock('services/factory/engine', async () => {
  const { tournamentEngine } = await import('tods-competition-factory');
  return { tournamentEngine };
});

import { keypadClearRefused, keypadOutcome } from './keypadOutcome';
import { takesHotkeyEntry } from './hotkeyScoreField';

const SCORE = '6-1 6-1';

/** An 8-draw with R1 #1 ended by `status`; the rest of the path to the final is played when `decideLater`. */
function doubleExitBracket(status: string, decideLater: boolean) {
  mocksEngine.generateTournamentRecord({ drawProfiles: [{ drawSize: 8 }], setState: true, nonRandom: 1 });
  const all = (): any[] => factoryEngine.allTournamentMatchUps().matchUps ?? [];
  const find = (roundNumber: number, roundPosition: number) =>
    all().find((m) => m.roundNumber === roundNumber && m.roundPosition === roundPosition);
  const { outcome } = mocksEngine.generateOutcomeFromScoreString({ scoreString: SCORE, winningSide: 1 });
  const score = (m: any): any => factoryEngine.setMatchUpStatus({ drawId: m.drawId, matchUpId: m.matchUpId, outcome });

  const origin = find(1, 1);
  const exited: any = factoryEngine.setMatchUpStatus({
    drawId: origin.drawId,
    matchUpId: origin.matchUpId,
    outcome: { matchUpStatus: status },
  });
  expect(exited.success).toBe(true);
  // R2 #1 now holds the exit produced from R1 #1; R3 #1 is the later match that depends on it
  if (decideLater) {
    for (const [round, position] of [
      [1, 2],
      [1, 3],
      [1, 4],
      [2, 2],
      [3, 1],
    ]) {
      expect(score(find(round, position)).success).toBe(true);
    }
  }
  return find(1, 1);
}

/** Backspace on the keypad, with the arguments hotKeyScoring passes to `keyValueScore`. */
function backspace(matchUp: any) {
  const { matchUpFormat, matchUpStatus, score, sets, winningSide } = matchUp;
  const typed = scoreGovernor.keyValueScore({
    scoreString: score?.scoreStringSide1,
    shiftFirst: true,
    sets: sets || [],
    matchUpStatus,
    matchUpFormat,
    winningSide,
    value: 'backspace',
  });
  expect(typed.updated).toBe(true);
  return keypadOutcome(typed);
}

describe('takesHotkeyEntry', () => {
  const ready = { readyToScore: true, matchUpFormat: 'SET3-S:6/TB7' };

  it('excludes a final result: a winner, or a COMPLETED tie', () => {
    expect(takesHotkeyEntry({ ...ready, matchUpStatus: 'COMPLETED', winningSide: 1 })).toBe(false);
    expect(takesHotkeyEntry({ ...ready, matchUpStatus: 'RETIRED', winningSide: 2 })).toBe(false);
    expect(takesHotkeyEntry({ ...ready, matchUpStatus: 'WALKOVER', winningSide: 1 })).toBe(false);
    expect(takesHotkeyEntry({ ...ready, matchUpStatus: 'DEFAULTED', winningSide: 2 })).toBe(false);
    expect(takesHotkeyEntry({ ...ready, matchUpStatus: 'COMPLETED' })).toBe(false);
  });

  it('takes an unfinished matchUp ready to score, including a double exit (no winner)', () => {
    expect(takesHotkeyEntry({ ...ready, matchUpStatus: 'TO_BE_PLAYED' })).toBe(true);
    expect(takesHotkeyEntry({ ...ready, matchUpStatus: 'IN_PROGRESS' })).toBe(true);
    expect(takesHotkeyEntry({ ...ready, matchUpStatus: 'DOUBLE_WALKOVER' })).toBe(true);
    expect(takesHotkeyEntry({ ...ready, matchUpStatus: 'DOUBLE_DEFAULT' })).toBe(true);
  });

  it('excludes a matchUp not ready to score, and a combined-point total', () => {
    expect(takesHotkeyEntry({ matchUpStatus: 'TO_BE_PLAYED' })).toBe(false);
    expect(takesHotkeyEntry({ readyToScore: true, matchUpFormat: 'SET1-S:P32' })).toBe(false);
  });
});

// The clear-refused branch in hotKeyScoring is NOT dead: a double exit has no winner, so it stays on the keypad,
// yet it propagates an exit into the next round, and once a later match is decided the engine refuses its clear.
describe('keypadClearRefused', () => {
  for (const status of ['DOUBLE_WALKOVER', 'DOUBLE_DEFAULT']) {
    it(`refuses clearing a ${status} a later match depends on, as the engine does`, () => {
      const matchUp = doubleExitBracket(status, true);
      expect(takesHotkeyEntry(matchUp)).toBe(true);

      const outcome = backspace(matchUp);
      expect(keypadClearRefused({ matchUp, outcome })).toBe(true);

      // ...and the engine agrees: the clear the keypad would have sent is refused
      const sent: any = factoryEngine.setMatchUpStatus({
        drawId: matchUp.drawId,
        matchUpId: matchUp.matchUpId,
        outcome,
      });
      expect(sent.success).toBeFalsy();
      expect(sent.error).toBeDefined();
    });

    it(`permits clearing a ${status} before the later match is decided`, () => {
      const matchUp = doubleExitBracket(status, false);
      expect(takesHotkeyEntry(matchUp)).toBe(true);

      const outcome = backspace(matchUp);
      expect(keypadClearRefused({ matchUp, outcome })).toBe(false);
      const sent: any = factoryEngine.setMatchUpStatus({
        drawId: matchUp.drawId,
        matchUpId: matchUp.matchUpId,
        outcome,
      });
      expect(sent.success).toBe(true);
    });
  }

  it('never refuses a score, only a clear', () => {
    const matchUp = doubleExitBracket('DOUBLE_WALKOVER', true);
    const { outcome } = mocksEngine.generateOutcomeFromScoreString({ scoreString: SCORE, winningSide: 1 });
    expect(keypadClearRefused({ matchUp, outcome: keypadOutcome({ ...outcome, sets: outcome.score.sets }) })).toBe(
      false,
    );
  });
});
