import { mocksEngine, tournamentEngine as factoryEngine } from 'tods-competition-factory';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The REAL engine, not a stand-in: the point of these helpers is to read the factory's own answer
// (`CLEAR_SCORE`), so a mock would only test that the mock agrees with itself.
vi.mock('services/factory/engine', async () => {
  const { tournamentEngine } = await import('tods-competition-factory');
  return { tournamentEngine };
});

import { clearPermitted, isClearingOutcome } from './clearScorePermission';

const SCORE = '6-1 6-1';

function scoredBracket() {
  mocksEngine.generateTournamentRecord({ drawProfiles: [{ drawSize: 8 }], setState: true, nonRandom: 1 });
  const matchUps: any[] = factoryEngine.allTournamentMatchUps().matchUps ?? [];
  const find = (roundNumber: number, roundPosition: number) =>
    matchUps.find((m) => m.roundNumber === roundNumber && m.roundPosition === roundPosition);
  const { outcome } = mocksEngine.generateOutcomeFromScoreString({ scoreString: SCORE, winningSide: 1 });
  const score = (m: any) => factoryEngine.setMatchUpStatus({ drawId: m.drawId, matchUpId: m.matchUpId, outcome });
  const current = (m: any) => factoryEngine.findMatchUp({ drawId: m.drawId, matchUpId: m.matchUpId }).matchUp;
  return { find, score, current };
}

describe('clearPermitted', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses where a later match depends on the result, as the engine does', () => {
    const { find, score, current } = scoredBracket();
    const [r1m1, r1m2, r2m1] = [find(1, 1), find(1, 2), find(2, 1)];
    score(r1m1);
    score(r1m2);
    score(r2m1);

    expect(clearPermitted({ matchUp: current(r1m1) })).toBe(false);
    // ...and the engine agrees: the clear it would have sent is refused
    const refused = factoryEngine.setMatchUpStatus({
      drawId: r1m1.drawId,
      matchUpId: r1m1.matchUpId,
      outcome: { score: { sets: [] }, matchUpStatusCodes: [] },
    });
    expect(refused.error).toBeDefined();

    // the final decided match has nothing after it
    expect(clearPermitted({ matchUp: current(r2m1) })).toBe(true);
  });

  it('permits a clear before the later match is decided', () => {
    const { find, score, current } = scoredBracket();
    score(find(1, 1));
    expect(clearPermitted({ matchUp: current(find(1, 1)) })).toBe(true);
  });

  it('permits a blank submission where there is nothing to remove', () => {
    const { find } = scoredBracket();
    expect(clearPermitted({ matchUp: find(1, 1) })).toBe(true);
  });

  it('does not block when the actions cannot be read', () => {
    expect(clearPermitted({ matchUp: { winningSide: 1, drawId: 'nope', matchUpId: 'nope' } })).toBe(true);
  });
});

describe('isClearingOutcome', () => {
  it('recognises the clear both dialogs send', () => {
    // openScoreEntryDialog, via engineOutcome
    expect(isClearingOutcome({ score: { sets: [] }, matchUpStatusCodes: [] })).toBe(true);
    // the older scoringModal, via scoreMatchUp's translation
    expect(isClearingOutcome({ score: { sets: [] }, matchUpStatus: undefined, winningSide: undefined })).toBe(true);
    expect(isClearingOutcome({ score: { sets: [] }, matchUpStatus: 'TO_BE_PLAYED' })).toBe(true);
  });

  it('does not mistake a result for a clear', () => {
    expect(isClearingOutcome({ score: { sets: [{ side1Score: 6, side2Score: 1 }] } })).toBe(false);
    expect(isClearingOutcome({ score: { sets: [] }, winningSide: 1, matchUpStatus: 'WALKOVER' })).toBe(false);
    // an irregular ending without a winner carries its status
    expect(isClearingOutcome({ score: { sets: [] }, matchUpStatus: 'ABANDONED' })).toBe(false);
    expect(isClearingOutcome(undefined)).toBe(false);
  });
});
