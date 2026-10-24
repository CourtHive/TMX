import { handleScoreClick as handleRoundScoreClick } from '../roundsTable/handleMatchUpScoreClick';
import { scoreActionPermitted } from 'services/transitions/scoreActionPermitted';
import { clearPermitted } from 'services/transitions/clearScorePermission';
import { mapMatchUp } from 'pages/tournament/tabs/matchUpsTab/mapMatchUp';
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scoreFormatter } from '../common/formatters/scoreFormatter';
import { handleScoreClick } from './handleMatchUpScoreClick';
import { featureFlags } from 'config/featureFlags';

const toastMock = vi.fn();
let capturedModalParams: any;

vi.mock('services/factory/engine', async () => ({
  tournamentEngine: (await import('tods-competition-factory')).tournamentEngine,
}));
// The shipped score modal is replaced by a capture; everything between the click and the mutation is real TMX code.
vi.mock('components/modals/scoringV2', () => ({
  scoringModal: (params: any) => {
    capturedModalParams = params;
  },
}));
// Applies the methods to the local engine, as an acknowledged mutation would.
const mutationRequestMock = vi.fn(({ methods, callback }: any) => callback(tournamentEngine.executionQueue(methods)));
vi.mock('services/mutation/mutationRequest', () => ({ mutationRequest: (p: any) => mutationRequestMock(p) }));
vi.mock('components/modals/baseModal/baseModal', () => ({ closeModal: vi.fn() }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: (...a: any[]) => toastMock(...a) }));
vi.mock('services/messaging/scoreRelay', () => ({ subscribeToMatchUp: vi.fn(), unsubscribeFromMatchUp: vi.fn() }));
vi.mock('courthive-components', () => ({ openScoreEntryDialog: vi.fn() }));
vi.mock('services/settings/settingsStorage', () => ({ persistConfigToStorage: vi.fn() }));
vi.mock('components/overlays/scorecard/scorecard', () => ({ openScorecard: vi.fn() }));
vi.mock('services/transitions/recordExitBeforeArrival', () => ({
  exitBeforeArrivalAction: () => undefined,
  recordExitBeforeArrival: vi.fn(),
}));
vi.mock('services/messaging/liveTrackedScores', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  getLiveTrackedScore: () => undefined,
}));
vi.mock('components/elements/matchUpActivityBadges', () => ({ createLiveTag: vi.fn(), createCrowdBadge: vi.fn() }));
vi.mock('services/crowd/delegatedReconciliation', () => ({ isMatchUpAwaitingReconciliation: () => false }));
vi.mock('config/preferencesConfig', () => ({ preferencesConfig: { get: () => ({ hotkeys: true }) } }));
vi.mock('config/deviceConfig', () => ({ deviceConfig: { get: () => ({ isMobile: false }) } }));
vi.mock('i18n', () => ({
  t: (key: string, o?: any) => (key === 'schedule.enterScore' ? 'Enter score' : (o?.defaultValue ?? key)),
}));

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

/** What the score modal hands back on submit. */
function modalOutcome(winningSide: number) {
  const { matchUpStatus, score } = completedOutcome(winningSide);
  return { matchUpStatus, winningSide, sets: score.sets };
}

/** A first-round RETIRED result imported with no score, whose winner has already won the next match. */
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
    let result: any = tournamentEngine.setMatchUpStatus({
      drawId: match.drawId,
      matchUpId: match.matchUpId,
      outcome: completedOutcome(winner),
    });
    expect(result).toMatchObject({ success: true });
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

const sideIds = (matchUp: any) => matchUp?.sides?.map((side: any) => side.participantId);
const cellFor = (data: any) => ({ getRow: () => ({ getData: () => data }) });

/** Clicks the score cell, then submits `outcome` from the score modal the click opened. */
function correctThroughTable(target: any, outcome: any) {
  handleScoreClick(vi.fn(), vi.fn())({}, cellFor({ matchUp: target }));
  expect(capturedModalParams?.matchUp?.matchUpId).toBe(target.matchUpId);
  capturedModalParams.callback(outcome);
  expect(mutationRequestMock).toHaveBeenCalledTimes(1);
  return mutationRequestMock.mock.calls[0][0].methods;
}

beforeEach(() => {
  featureFlags.set({ scoreEntryDialog: false });
  capturedModalParams = undefined;
  vi.stubGlobal('document', {
    createElement: () => ({ classList: { add: vi.fn() }, style: {}, textContent: '', prepend: vi.fn() }),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('a scoreless recorded retirement with a completed downstream match', () => {
  it('displays RET rather than Enter score even when readyToScore is false', () => {
    const { target } = importedRetirement();
    let result: any = scoreFormatter(cellFor({ matchUp: target, score: '', readyToScore: false }));
    expect(result?.textContent).toBe('RET');
  });

  it('opens the correction dialog despite no score string or readyToScore, including with hotkeys enabled', () => {
    const { target } = importedRetirement();
    const setFocus = vi.fn();
    handleScoreClick(vi.fn(), setFocus)({}, cellFor({ matchUp: target }));
    expect(capturedModalParams?.matchUp?.matchUpId).toBe(target.matchUpId);
    expect(setFocus).not.toHaveBeenCalled();
  });

  it('also opens scoreless corrections from the round table', () => {
    const { target } = importedRetirement();
    handleRoundScoreClick(vi.fn())({}, cellFor({ matchUp: target }));
    expect(capturedModalParams?.matchUp?.matchUpId).toBe(target.matchUpId);
  });

  it('permits scoring but withholds result removal', () => {
    const { target } = importedRetirement();
    expect(scoreActionPermitted(target)).toBe(true);
    expect(clearPermitted({ matchUp: target })).toBe(false);
  });

  it('sends a same-winner correction with change propagation and leaves the next match untouched', () => {
    const { target, nextId } = importedRetirement();
    const before = tournamentEngine.q.matchUp({ matchUpId: nextId });
    let result: any = correctThroughTable(target, modalOutcome(2));
    expect(result).toEqual([
      expect.objectContaining({
        method: 'setMatchUpStatus',
        params: expect.objectContaining({ allowChangePropagation: true, matchUpId: target.matchUpId }),
      }),
    ]);
    expect(tournamentEngine.q.matchUp({ matchUpId: target.matchUpId })?.score?.scoreStringSide1).toBe('3-6 3-6');
    expect(tournamentEngine.q.matchUp({ matchUpId: nextId })).toEqual(before);
  });

  it('swaps the new winner into the next match, which keeps its result, on a winner reversal', () => {
    const { target, nextId } = importedRetirement();
    const [oldLoser, oldWinner] = sideIds(target);
    const before: any = tournamentEngine.q.matchUp({ matchUpId: nextId });
    expect(sideIds(before)).toContain(oldWinner);

    correctThroughTable(target, modalOutcome(1));
    expect(toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ intent: 'is-danger' }));
    expect(tournamentEngine.q.matchUp({ matchUpId: target.matchUpId })?.winningSide).toBe(1);

    // swapWinnerLoser's contract: the new winner takes the old winner's seat downstream; the result there stands.
    let result: any = tournamentEngine.q.matchUp({ matchUpId: nextId });
    expect(sideIds(result)).toContain(oldLoser);
    expect(sideIds(result)).not.toContain(oldWinner);
    expect(result.matchUpStatus).toBe(before.matchUpStatus);
    expect(result.winningSide).toBe(before.winningSide);
    expect(result.score?.scoreStringSide1).toBe(before.score?.scoreStringSide1);
  });

  it('decides the empty-cell entry advertisement once, as the row is built', () => {
    const { target } = importedRetirement();
    let result: any = mapMatchUp(target);
    // Shown as RET, so the row does not need to ask the factory whether an empty cell may advertise entry.
    expect(result.scorePermitted).toBe(false);
    expect(scoreFormatter(cellFor(result))?.textContent).toBe('RET');
  });

  it('does not advertise or open scoring without a SCORE action', () => {
    importedRetirement();
    const matchUp = { matchUpId: 'absent', drawId: 'absent', readyToScore: true };
    expect(scoreFormatter(cellFor({ matchUp, readyToScore: true, scorePermitted: false }))).toBeUndefined();
    const setFocus = vi.fn();
    handleScoreClick(vi.fn(), setFocus)({}, cellFor({ matchUp }));
    expect(capturedModalParams).toBeUndefined();
    expect(setFocus).not.toHaveBeenCalled();
    // The empty cell advertised nothing, so nothing is said.
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('says why a shown result cannot be opened', () => {
    importedRetirement();
    const matchUp = { matchUpId: 'absent', drawId: 'absent', matchUpStatus: 'RETIRED' };
    handleScoreClick(vi.fn(), vi.fn())({}, cellFor({ matchUp }));
    handleRoundScoreClick(vi.fn())({}, cellFor({ matchUp }));
    expect(capturedModalParams).toBeUndefined();
    expect(toastMock).toHaveBeenCalledTimes(2);
    expect(toastMock).toHaveBeenCalledWith({ message: 'toasts.scoreRefused', intent: 'is-warning' });
  });

  it('continues displaying score strings and scoreless walkovers', () => {
    expect(scoreFormatter(cellFor({ matchUp: { matchUpStatus: 'WALKOVER' } }))?.textContent).toBe('WO');
    expect(scoreFormatter(cellFor({ matchUp: { matchUpStatus: 'RETIRED' }, score: '6-3 2-1' }))?.textContent).toBe(
      '6-3 2-1',
    );
  });
});
