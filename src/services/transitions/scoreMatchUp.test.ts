import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Remote-scoring collision: if a broadcast scores the matchUp the director is
 * currently entering a score for, warn them, and require an explicit Overwrite
 * confirm on save so they can't silently clobber the colleague's result.
 */
const toastMock = vi.fn();
const mutationRequestMock = vi.fn();
const closeModalMock = vi.fn();
const actionsMock = vi.fn((..._args: any[]): any => ({ validActions: [] }));
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
    matchUpActions: (...args: any[]) => actionsMock(...args),
    parseScoreString: () => [{ side1Score: 6, side2Score: 1 }],
  },
}));
vi.mock('i18n', () => ({ t: (k: string, o?: any) => o?.defaultValue ?? k }));

import { notifyRemoteScoringCollision } from './activeScoringGuard';
import { dialogSides, enterMatchUpScore } from './scoreMatchUp';
import { preferencesConfig } from 'config/preferencesConfig';

const WARNING_INTENT = 'is-warning';

/** The dialog reports an engine-ready outcome; what reaches `setMatchUpStatus` is that outcome. */
const ENGINE_OUTCOME = {
  matchUpStatus: 'COMPLETED',
  winningSide: 2,
  score: { sets: [{ setNumber: 1, side1Score: 3, side2Score: 6, winningSide: 2 }] },
};

/** Submit through the open dialog, and close it. */
const submit = (outcome: any = ENGINE_OUTCOME) => capturedDialogParams.onSubmit({ outcome, sets: [] });
const close = () => capturedDialogParams.onClose();

describe('scoreMatchUp — remote scoring collision', () => {
  beforeEach(() => {
    toastMock.mockClear();
    mutationRequestMock.mockClear();
    closeModalMock.mockClear();
    capturedDialogParams = undefined;
  });

  it('applies immediately when no remote collision occurred', () => {
    enterMatchUpScore({ matchUpId: 'X', matchUp: { drawId: 'd1' } });
    submit();
    expect(mutationRequestMock).toHaveBeenCalledTimes(1);
    close(); // reset module state
  });

  it('ignores a broadcast for a different matchUp', () => {
    enterMatchUpScore({ matchUpId: 'X', matchUp: { drawId: 'd1' } });
    notifyRemoteScoringCollision(['Y']);
    expect(toastMock).not.toHaveBeenCalled();
    submit();
    expect(mutationRequestMock).toHaveBeenCalledTimes(1); // no confirm needed
    close();
  });

  it('warns on collision and requires an explicit Overwrite confirm before saving', () => {
    enterMatchUpScore({ matchUpId: 'X', matchUp: { drawId: 'd1' } });

    notifyRemoteScoringCollision(['X']);
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ intent: WARNING_INTENT }));
    toastMock.mockClear();

    // Save must NOT apply directly — it surfaces a danger confirm with an action.
    submit();
    expect(mutationRequestMock).not.toHaveBeenCalled();
    const confirm = toastMock.mock.calls.map((c) => c[0]).find((a) => a.intent === 'is-danger' && a.action);
    expect(confirm, 'a danger confirm toast with an Overwrite action').toBeTruthy();

    // Clicking Overwrite applies the director's score.
    confirm.action.onClick();
    expect(mutationRequestMock).toHaveBeenCalledTimes(1);
    close();
  });

  it('clears collision state on modal close so a later broadcast does not false-trigger', () => {
    enterMatchUpScore({ matchUpId: 'X', matchUp: { drawId: 'd1' } });
    close(); // modal closed
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

  it("toasts the refusal's info, which names the set, and keeps the dialog open", () => {
    enterMatchUpScore({ matchUpId: 'X', matchUp: { drawId: 'd1' } });
    submit();
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
    close();
  });

  it('falls back to the error message when no info comes back', () => {
    enterMatchUpScore({ matchUpId: 'X', matchUp: { drawId: 'd1' } });
    submit();
    const { callback } = mutationRequestMock.mock.calls[0][0];
    callback({ error: { message: INVALID_SCORE_MESSAGE } });

    expect(toastMock).toHaveBeenCalledWith({ message: INVALID_SCORE_MESSAGE, intent: 'is-danger' });
    close();
  });
});

/**
 * The score entry dialog — the only front end since the three old scoring modals were removed. It hands
 * TMX an engine-ready outcome, so what reaches `setMatchUpStatus` is that outcome and nothing TMX rebuilt.
 */
const MATCHUP = {
  drawId: 'd1',
  matchUpFormat: 'SET3-S:6/TB7',
  roundName: 'R16',
  sides: [
    { sideNumber: 1, participant: { participantName: 'Ann' }, seedValue: 1 },
    { sideNumber: 2, participant: { participantName: 'Bea' } },
  ],
};

describe('scoreMatchUp — the score entry dialog', () => {
  beforeEach(() => {
    preferencesConfig.set({ scoringApproach: 'dynamicSets' });
    toastMock.mockClear();
    mutationRequestMock.mockClear();
    closeModalMock.mockClear();
    capturedDialogParams = undefined;
  });

  it('opens with the display names, the seed, the context and the preferred approach', () => {
    preferencesConfig.set({ scoringApproach: 'dialPad' });
    enterMatchUpScore({ matchUpId: 'X', matchUp: MATCHUP });
    expect(capturedDialogParams.matchUp).toBe(MATCHUP);
    expect(capturedDialogParams.sides).toEqual([{ participantName: 'Ann', seed: '1' }, { participantName: 'Bea' }]);
    expect(capturedDialogParams.context).toBe('R16');
    expect(capturedDialogParams.approach).toBe('dialPad');
    capturedDialogParams.onClose();
  });

  it('leaves the approach to the dialog when the stored preference is one it does not offer', () => {
    // 'inlineScoring' was a Settings choice until 2026-10-25 and can still be in a browser's storage.
    preferencesConfig.set({ scoringApproach: 'inlineScoring' as any });
    enterMatchUpScore({ matchUpId: 'X', matchUp: MATCHUP });
    expect(capturedDialogParams.approach).toBeUndefined();
    capturedDialogParams.onClose();
  });

  it("hands the dialog's engine-ready outcome to setMatchUpStatus as a copy, with propagation allowed", () => {
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
    enterMatchUpScore({ matchUpId: 'X', matchUp: MATCHUP });
    capturedDialogParams.onApproachChange('freeScore');
    expect(preferencesConfig.get().scoringApproach).toBe('freeScore');
    capturedDialogParams.onClose();
  });

  it('tells the operator what a format change discarded', () => {
    enterMatchUpScore({ matchUpId: 'X', matchUp: MATCHUP });
    capturedDialogParams.onScoreDiscarded({
      sets: [],
      discarded: [{ side1Score: 6, side2Score: 4 }],
      matchUpFormat: 'SET1-S:6/TB7',
    });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ intent: WARNING_INTENT }));
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

describe('scoreMatchUp — engine status restrictions', () => {
  beforeEach(() => {
    mutationRequestMock.mockClear();
    toastMock.mockClear();
    actionsMock.mockReturnValue({
      validActions: [{ type: 'SCORE', disabledMatchUpStatuses: ['DEAD_RUBBER', 'CHALLENGED'] }],
    });
  });

  it('forwards the restrictions and their labels to the dialog', () => {
    enterMatchUpScore({ matchUpId: 'X', matchUp: MATCHUP });
    expect(capturedDialogParams.disabledMatchUpStatuses).toEqual(['DEAD_RUBBER', 'CHALLENGED']);
    expect(capturedDialogParams.labels).toMatchObject({
      DEAD_RUBBER: 'modals.scoring.deadRubber',
      statusUnavailable: 'modals.scoring.statusUnavailable',
    });
    expect(actionsMock).toHaveBeenCalledWith({ drawId: 'd1', matchUpId: 'X' });
    close();
    actionsMock.mockReturnValue({ validActions: [] });
  });

  it('checks live scope again before submitting', () => {
    actionsMock.mockReturnValue({ validActions: [{ type: 'SCORE', disabledMatchUpStatuses: [] }] });
    enterMatchUpScore({ matchUpId: 'X', matchUp: MATCHUP });
    actionsMock.mockReturnValue({ validActions: [{ type: 'SCORE', disabledMatchUpStatuses: ['DEAD_RUBBER'] }] });
    capturedDialogParams.onSubmit({ outcome: { matchUpStatus: 'DEAD_RUBBER' } });
    expect(mutationRequestMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith({
      message: 'toasts.statusOutOfScope',
      intent: WARNING_INTENT,
      pauseOnHover: true,
    });
    capturedDialogParams.onSubmit({ outcome: { matchUpStatus: 'CANCELLED' } });
    expect(mutationRequestMock).toHaveBeenCalledTimes(1);
    capturedDialogParams.onClose();
    actionsMock.mockReturnValue({ validActions: [] });
  });
});
