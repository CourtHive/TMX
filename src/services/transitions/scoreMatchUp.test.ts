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
// The components barrel reaches `document` at load (the datepicker), so it cannot be imported under node.
let capturedDialogParams: any;
vi.mock('courthive-components', () => ({
  openScoreEntryDialog: (params: any) => {
    capturedDialogParams = params;
    return { close: vi.fn() };
  },
}));
vi.mock('services/settings/settingsStorage', () => ({ persistConfigToStorage: vi.fn() }));
vi.mock('services/factory/engine', () => ({
  tournamentEngine: {
    q: { matchUp: ({ matchUpId }: any) => ({ matchUpId, drawId: 'd1', score: { scoreStringSide1: '6-2 6-3' } }) },
    parseScoreString: () => [{ side1Score: 6, side2Score: 1 }],
  },
}));
vi.mock('i18n', () => ({ t: (k: string, o?: any) => o?.defaultValue ?? k }));

import { notifyRemoteScoringCollision } from './activeScoringGuard';
import { dialogSides, enterMatchUpScore } from './scoreMatchUp';
import { preferencesConfig } from 'config/preferencesConfig';
import { featureFlags } from 'config/featureFlags';

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

const INVALID_SCORE_MESSAGE = 'Invalid score';

describe('scoreMatchUp — a refused score', () => {
  beforeEach(() => {
    toastMock.mockClear();
    mutationRequestMock.mockClear();
    closeModalMock.mockClear();
  });

  it("toasts the refusal's info, which names the set, and keeps the modal open", () => {
    enterMatchUpScore({ matchUpId: 'X', matchUp: { drawId: 'd1' } });
    capturedScoreSubmitted!(OUTCOME);
    const { callback } = mutationRequestMock.mock.calls[0][0];
    callback({
      error: { message: INVALID_SCORE_MESSAGE, code: 'ERR_INVALID_SCORE' },
      info: 'Set 1: Set winner must reach 6 games, got 4',
    });

    expect(toastMock).toHaveBeenCalledWith({
      message: 'Set 1: Set winner must reach 6 games, got 4',
      intent: 'is-danger',
    });
    expect(closeModalMock).not.toHaveBeenCalled();
    capturedOnRelayCleanup!();
  });

  it('falls back to the error message when no info comes back', () => {
    enterMatchUpScore({ matchUpId: 'X', matchUp: { drawId: 'd1' } });
    capturedScoreSubmitted!(OUTCOME);
    const { callback } = mutationRequestMock.mock.calls[0][0];
    callback({ error: { message: INVALID_SCORE_MESSAGE } });

    expect(toastMock).toHaveBeenCalledWith({ message: INVALID_SCORE_MESSAGE, intent: 'is-danger' });
    capturedOnRelayCleanup!();
  });
});

/**
 * The beta front end (CA, 2026-10-08: the new score entry dialog behind a flag). The dialog reports an
 * engine-ready outcome, so what reaches `setMatchUpStatus` is that outcome and nothing TMX rebuilt.
 */
const ENGINE_OUTCOME = {
  matchUpStatus: 'COMPLETED',
  winningSide: 2,
  score: { sets: [{ setNumber: 1, side1Score: 3, side2Score: 6, winningSide: 2 }] },
};
const MATCHUP = {
  drawId: 'd1',
  matchUpFormat: 'SET3-S:6/TB7',
  roundName: 'R16',
  sides: [
    { sideNumber: 1, participant: { participantName: 'Ann' }, seedValue: 1 },
    { sideNumber: 2, participant: { participantName: 'Bea' } },
  ],
};

describe('scoreMatchUp — the score entry dialog behind the beta flag', () => {
  beforeEach(() => {
    featureFlags.reset();
    preferencesConfig.set({ scoringApproach: 'dynamicSets' });
    toastMock.mockClear();
    mutationRequestMock.mockClear();
    closeModalMock.mockClear();
    capturedDialogParams = undefined;
    capturedScoreSubmitted = undefined;
  });

  it('is not opened while the flag is off: the shipped modal is', () => {
    enterMatchUpScore({ matchUpId: 'X', matchUp: MATCHUP });
    expect(capturedDialogParams).toBeUndefined();
    expect(capturedScoreSubmitted).toBeTypeOf('function');
    capturedOnRelayCleanup!();
  });

  it('opens with the display names, the seed, the context and the preferred approach', () => {
    featureFlags.set({ scoreEntryDialog: true });
    preferencesConfig.set({ scoringApproach: 'dialPad' });
    enterMatchUpScore({ matchUpId: 'X', matchUp: MATCHUP });
    expect(capturedScoreSubmitted).toBeUndefined();
    expect(capturedDialogParams.matchUp).toBe(MATCHUP);
    expect(capturedDialogParams.sides).toEqual([{ participantName: 'Ann', seed: '1' }, { participantName: 'Bea' }]);
    expect(capturedDialogParams.context).toBe('R16');
    expect(capturedDialogParams.approach).toBe('dialPad');
    capturedDialogParams.onClose();
  });

  it('leaves the approach to the dialog when the preference is one it does not offer', () => {
    featureFlags.set({ scoreEntryDialog: true });
    preferencesConfig.set({ scoringApproach: 'inlineScoring' });
    enterMatchUpScore({ matchUpId: 'X', matchUp: MATCHUP });
    expect(capturedDialogParams.approach).toBeUndefined();
    capturedDialogParams.onClose();
  });

  it("hands the dialog's engine-ready outcome to setMatchUpStatus as a copy, with propagation allowed", () => {
    featureFlags.set({ scoreEntryDialog: true });
    const callback = vi.fn();
    enterMatchUpScore({ matchUpId: 'X', matchUp: MATCHUP, callback });
    capturedDialogParams.onSubmit({ outcome: ENGINE_OUTCOME, sets: ENGINE_OUTCOME.score.sets });

    expect(mutationRequestMock).toHaveBeenCalledTimes(1);
    const { methods, callback: mutationCallback } = mutationRequestMock.mock.calls[0][0];
    expect(methods).toEqual([
      {
        method: 'setMatchUpStatus',
        params: { allowChangePropagation: true, drawId: 'd1', matchUpId: 'X', outcome: ENGINE_OUTCOME },
      },
    ]);
    expect(methods[0].params.outcome).not.toBe(ENGINE_OUTCOME);

    mutationCallback({ success: true });
    // the dialog closes itself on Submit; TMX must not pop whatever modal is on top
    expect(closeModalMock).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ success: true, outcome: ENGINE_OUTCOME }));
    capturedDialogParams.onClose();
  });

  it('still guards against a colleague scoring the same matchUp meanwhile', () => {
    featureFlags.set({ scoreEntryDialog: true });
    enterMatchUpScore({ matchUpId: 'X', matchUp: MATCHUP });
    notifyRemoteScoringCollision(['X']);
    toastMock.mockClear();

    capturedDialogParams.onSubmit({ outcome: ENGINE_OUTCOME, sets: [] });
    expect(mutationRequestMock).not.toHaveBeenCalled();
    const confirm = toastMock.mock.calls.map((c) => c[0]).find((a) => a.intent === 'is-danger' && a.action);
    expect(confirm, 'a danger confirm toast with an Overwrite action').toBeTruthy();
    confirm.action.onClick();
    expect(mutationRequestMock).toHaveBeenCalledTimes(1);
    capturedDialogParams.onClose();
  });

  it('remembers the approach the operator switched to', () => {
    featureFlags.set({ scoreEntryDialog: true });
    enterMatchUpScore({ matchUpId: 'X', matchUp: MATCHUP });
    capturedDialogParams.onApproachChange('freeScore');
    expect(preferencesConfig.get().scoringApproach).toBe('freeScore');
    capturedDialogParams.onClose();
  });

  it('tells the operator what a format change discarded', () => {
    featureFlags.set({ scoreEntryDialog: true });
    enterMatchUpScore({ matchUpId: 'X', matchUp: MATCHUP });
    capturedDialogParams.onScoreDiscarded({
      sets: [],
      discarded: [{ side1Score: 6, side2Score: 4 }],
      matchUpFormat: 'SET1-S:6/TB7',
    });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ intent: 'is-warning' }));
    capturedDialogParams.onClose();
  });
});

describe('dialogSides', () => {
  it('names a bye and leaves an empty side blank', () => {
    expect(dialogSides({ sides: [{ sideNumber: 1, bye: true }, { sideNumber: 2 }] })).toEqual([
      { participantName: 'BYE' },
      { participantName: '' },
    ]);
  });

  it('copes with a matchUp that has no sides at all', () => {
    expect(dialogSides({})).toEqual([{ participantName: '' }, { participantName: '' }]);
  });
});
