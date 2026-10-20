import { handleScoreClick as handleRoundScoreClick } from '../roundsTable/handleMatchUpScoreClick';
import { scoreActionPermitted } from 'services/transitions/scoreActionPermitted';
import { clearPermitted } from 'services/transitions/clearScorePermission';
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scoreFormatter } from '../common/formatters/scoreFormatter';
import { handleScoreClick } from './handleMatchUpScoreClick';

vi.mock('services/factory/engine', async () => ({
  tournamentEngine: (await import('tods-competition-factory')).tournamentEngine,
}));
vi.mock('services/transitions/scoreMatchUp', () => ({ enterMatchUpScore: vi.fn() }));
vi.mock('components/overlays/scorecard/scorecard', () => ({ openScorecard: vi.fn() }));
vi.mock('services/transitions/recordExitBeforeArrival', () => ({
  exitBeforeArrivalAction: () => undefined,
  recordExitBeforeArrival: vi.fn(),
}));
vi.mock('services/messaging/crowdsourcedScores', () => ({ isMatchUpCrowdsourced: () => false }));
vi.mock('services/crowd/delegatedReconciliation', () => ({ isMatchUpAwaitingReconciliation: () => false }));
vi.mock('config/preferencesConfig', () => ({ preferencesConfig: { get: () => ({ hotkeys: true }) } }));
vi.mock('config/deviceConfig', () => ({ deviceConfig: { get: () => ({ isMobile: false }) } }));
vi.mock('i18n', () => ({ t: () => 'Enter score' }));

import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';

function completedOutcome(winningSide: number) {
  return {
    matchUpStatus: 'COMPLETED',
    winningSide,
    score: {
      sets: [1, 2].map((setNumber) => ({
        setNumber,
        side1Score: winningSide === 1 ? 6 : 3,
        side2Score: winningSide === 2 ? 6 : 3,
        winningSide,
      })),
    },
  };
}

function importedRetirement() {
  mocksEngine.generateTournamentRecord({ nonRandom: 1, drawProfiles: [{ drawSize: 4 }], setState: true });
  const all = tournamentEngine.allTournamentMatchUps().matchUps ?? [];
  const target = all.find((m) => m.roundNumber === 1 && m.roundPosition === 1);
  const sibling = all.find((m) => m.roundNumber === 1 && m.roundPosition === 2);
  const next = all.find((m) => m.roundNumber === 2);
  if (!target || !sibling || !next) throw new Error('Fixture bracket is incomplete');
  const targetId = target.matchUpId;
  for (const [match, winner] of [
    [target, 2],
    [sibling, 1],
    [next, 2],
  ] as const) {
    expect(
      tournamentEngine.setMatchUpStatus({
        drawId: match.drawId,
        matchUpId: match.matchUpId,
        outcome: completedOutcome(winner),
      }),
    ).toMatchObject({ success: true });
  }
  const { tournamentRecord } = tournamentEngine.getTournament();
  function replace(value: any): void {
    if (!value || typeof value !== 'object') return undefined;
    if (value.matchUpId === targetId) {
      value.matchUpStatus = 'RETIRED';
      value.score = {
        sets: [],
        scoreStringSide1: '',
        scoreStringSide2: '',
        side1PointScore: '0',
        side2PointScore: '0',
      };
      return undefined;
    }
    for (const child of Object.values(value)) replace(child);
  }
  replace(tournamentRecord);
  tournamentEngine.setState(tournamentRecord);
  const imported = tournamentEngine.q.matchUp({ matchUpId: target.matchUpId });
  if (!imported) throw new Error('Imported matchUp is missing');
  return { target: imported, nextId: next.matchUpId };
}

const cellFor = (data: any) => ({ getRow: () => ({ getData: () => data }) });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('document', {
    createElement: () => ({ classList: { add: vi.fn() }, style: {}, textContent: '', prepend: vi.fn() }),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('a scoreless recorded retirement with a completed downstream match', () => {
  it('displays RET rather than Enter score even when readyToScore is false', () => {
    const { target } = importedRetirement();
    expect(scoreFormatter(cellFor({ matchUp: target, score: '', readyToScore: false }))?.textContent).toBe('RET');
  });

  it('opens the correction dialog despite no score string or readyToScore, including with hotkeys enabled', () => {
    const { target } = importedRetirement();
    const refresh = vi.fn();
    const setFocus = vi.fn();
    handleScoreClick(refresh, setFocus)({}, cellFor({ matchUp: target }));
    expect(enterMatchUpScore).toHaveBeenCalledWith({ matchUp: target, matchUpId: target.matchUpId, callback: refresh });
    expect(setFocus).not.toHaveBeenCalled();
  });

  it('also opens scoreless corrections from the round table', () => {
    const { target } = importedRetirement();
    const refresh = vi.fn();
    handleRoundScoreClick(refresh)({}, cellFor({ matchUp: target }));
    expect(enterMatchUpScore).toHaveBeenCalledWith({
      matchUp: target,
      matchUpId: target.matchUpId,
      callback: expect.any(Function),
    });
  });

  it('permits same-winner corrections while refusing removal and winner reversal', () => {
    const { target, nextId } = importedRetirement();
    expect(scoreActionPermitted(target)).toBe(true);
    expect(clearPermitted({ matchUp: target })).toBe(false);
    const before = tournamentEngine.q.matchUp({ matchUpId: nextId });
    const result = tournamentEngine.setMatchUpStatus({
      drawId: target.drawId,
      matchUpId: target.matchUpId,
      outcome: completedOutcome(2),
    });
    expect(result).toMatchObject({ success: true });
    expect(tournamentEngine.q.matchUp({ matchUpId: nextId })).toEqual(before);
    expect(
      tournamentEngine.setMatchUpStatus({
        drawId: target.drawId,
        matchUpId: target.matchUpId,
        outcome: completedOutcome(1),
      }).error,
    ).toBeDefined();
  });

  it('does not advertise or open scoring without a SCORE action', () => {
    const matchUp = { matchUpId: 'absent', drawId: 'absent', readyToScore: true };
    expect(scoreFormatter(cellFor({ matchUp, readyToScore: true }))).toBeUndefined();
    handleScoreClick(vi.fn(), vi.fn())({}, cellFor({ matchUp }));
    expect(enterMatchUpScore).not.toHaveBeenCalled();
  });

  it('continues displaying score strings and scoreless walkovers', () => {
    expect(scoreFormatter(cellFor({ matchUp: { matchUpStatus: 'WALKOVER' } }))?.textContent).toBe('WO');
    expect(scoreFormatter(cellFor({ matchUp: { matchUpStatus: 'RETIRED' }, score: '6-3 2-1' }))?.textContent).toBe(
      '6-3 2-1',
    );
  });
});
