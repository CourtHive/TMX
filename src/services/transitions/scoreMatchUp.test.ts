import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Remote-scoring collision: if a broadcast scores the matchUp the director is
 * currently entering a score for, warn them, and require an explicit Overwrite
 * confirm on save so they can't silently clobber the colleague's result.
 */
const toastMock = vi.fn();
const mutationRequestMock = vi.fn();
const closeModalMock = vi.fn();

let capturedScoreSubmitted: ((outcome: any) => void) | undefined;
let capturedOnRelayCleanup: (() => void) | undefined;

vi.mock('components/modals/scoringV2', () => ({
  scoringModal: (params: any) => {
    capturedScoreSubmitted = params.callback;
    capturedOnRelayCleanup = params.onRelayCleanup;
  },
}));
vi.mock('services/mutation/mutationRequest', () => ({ mutationRequest: (...a: any[]) => mutationRequestMock(...a) }));
vi.mock('components/modals/baseModal/baseModal', () => ({ closeModal: () => closeModalMock() }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: (...a: any[]) => toastMock(...a) }));
vi.mock('services/messaging/scoreRelay', () => ({ subscribeToMatchUp: vi.fn(), unsubscribeFromMatchUp: vi.fn() }));
vi.mock('services/factory/engine', () => ({
  tournamentEngine: {
    q: { matchUp: ({ matchUpId }: any) => ({ matchUpId, drawId: 'd1', score: { scoreStringSide1: '6-2 6-3' } }) },
    parseScoreString: () => [{ side1Score: 6, side2Score: 1 }],
  },
}));
vi.mock('i18n', () => ({ t: (k: string, o?: any) => o?.defaultValue ?? k }));

import { notifyRemoteScoringCollision } from './activeScoringGuard';
import { enterMatchUpScore } from './scoreMatchUp';

const OUTCOME = { score: '6-1 6-1', winningSide: 1, matchUpStatus: 'COMPLETED' };

describe('scoreMatchUp — remote scoring collision', () => {
  beforeEach(() => {
    toastMock.mockClear();
    mutationRequestMock.mockClear();
    closeModalMock.mockClear();
    capturedScoreSubmitted = undefined;
    capturedOnRelayCleanup = undefined;
  });

  it('applies immediately when no remote collision occurred', () => {
    enterMatchUpScore({ matchUpId: 'X', matchUp: { drawId: 'd1' } });
    capturedScoreSubmitted!(OUTCOME);
    expect(mutationRequestMock).toHaveBeenCalledTimes(1);
    capturedOnRelayCleanup!(); // reset module state
  });

  it('ignores a broadcast for a different matchUp', () => {
    enterMatchUpScore({ matchUpId: 'X', matchUp: { drawId: 'd1' } });
    notifyRemoteScoringCollision(['Y']);
    expect(toastMock).not.toHaveBeenCalled();
    capturedScoreSubmitted!(OUTCOME);
    expect(mutationRequestMock).toHaveBeenCalledTimes(1); // no confirm needed
    capturedOnRelayCleanup!();
  });

  it('warns on collision and requires an explicit Overwrite confirm before saving', () => {
    enterMatchUpScore({ matchUpId: 'X', matchUp: { drawId: 'd1' } });

    notifyRemoteScoringCollision(['X']);
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ intent: 'is-warning' }));
    toastMock.mockClear();

    // Save must NOT apply directly — it surfaces a danger confirm with an action.
    capturedScoreSubmitted!(OUTCOME);
    expect(mutationRequestMock).not.toHaveBeenCalled();
    const confirm = toastMock.mock.calls.map((c) => c[0]).find((a) => a.intent === 'is-danger' && a.action);
    expect(confirm, 'a danger confirm toast with an Overwrite action').toBeTruthy();

    // Clicking Overwrite applies the director's score.
    confirm.action.onClick();
    expect(mutationRequestMock).toHaveBeenCalledTimes(1);
    capturedOnRelayCleanup!();
  });

  it('clears collision state on modal close so a later broadcast does not false-trigger', () => {
    enterMatchUpScore({ matchUpId: 'X', matchUp: { drawId: 'd1' } });
    capturedOnRelayCleanup!(); // modal closed
    notifyRemoteScoringCollision(['X']);
    expect(toastMock).not.toHaveBeenCalled();
  });
});
