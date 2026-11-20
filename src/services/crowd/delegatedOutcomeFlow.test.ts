import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Accepting a trusted crowd session promotes its live feed on the relay. The toast and the callback must report
 * what the relay actually did (ecosystem review 690): a refused or unavailable promotion is not "promoted".
 */
const promoteSessionMock = vi.fn();
const toastMock = vi.fn();
const mutationRequestMock = vi.fn();
const buildAcceptMethodsMock = vi.fn((..._args: any[]): any[] => []);

vi.mock('services/crowd/scoreRelayClient', () => ({
  promoteSession: (...a: any[]) => promoteSessionMock(...a),
  getSessionsByMatchUpId: vi.fn(),
}));
vi.mock('services/crowd/delegatedOutcome', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  buildAcceptMethods: (...a: any[]) => buildAcceptMethodsMock(...a),
}));
vi.mock('services/mutation/mutationRequest', () => ({ mutationRequest: (...a: any[]) => mutationRequestMock(...a) }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: (...a: any[]) => toastMock(...a) }));
vi.mock('services/transitions/scoreMatchUp', () => ({ dialogSides: vi.fn() }));
vi.mock('components/modals/scoringV2/scoringLabels', () => ({ getScoreEntryLabels: vi.fn() }));
// The components barrel reaches `document` at load, so it cannot be imported under node.
vi.mock('courthive-components', () => ({ openScoreEntryDialog: vi.fn() }));
vi.mock('i18n', () => ({ t: (k: string) => k }));

import { acceptTrustedSession } from './delegatedOutcomeFlow';

const session: any = { sessionId: 's-1', matchUpId: 'm-1' };
const args = (callback = vi.fn()) => ({ session, matchUpId: 'm-1', drawId: 'd-1', callback });
const toastKeys = () => toastMock.mock.calls.map(([params]) => params.message);

describe('acceptTrustedSession — reports the promotion the relay made', () => {
  beforeEach(() => {
    promoteSessionMock.mockReset();
    toastMock.mockClear();
    mutationRequestMock.mockClear();
    buildAcceptMethodsMock.mockReturnValue([]);
  });

  it('reports promoted only when the relay returns the promoted session', async () => {
    promoteSessionMock.mockResolvedValue({ sessionId: 's-1' });
    const callback = vi.fn();
    await acceptTrustedSession(args(callback));
    expect(toastKeys()).toEqual(['crowd.toast.acceptedLive']);
    expect(callback).toHaveBeenCalledWith({ promoted: true });
  });

  it('does not report a rejected promotion as promoted', async () => {
    promoteSessionMock.mockRejectedValue(new Error('403'));
    const callback = vi.fn();
    await acceptTrustedSession(args(callback));
    expect(toastKeys()).toEqual(['crowd.toast.promoteFailed']);
    expect(callback).toHaveBeenCalledWith({ promoted: false });
  });

  it('does not report an unconfigured relay as promoted', async () => {
    promoteSessionMock.mockResolvedValue(undefined);
    const callback = vi.fn();
    await acceptTrustedSession(args(callback));
    expect(toastKeys()).not.toContain('crowd.toast.acceptedLive');
    expect(callback).toHaveBeenCalledWith({ promoted: false });
  });

  it('still applies a completed session to the record when promotion fails, and says so', async () => {
    promoteSessionMock.mockRejectedValue(new Error('relay down'));
    buildAcceptMethodsMock.mockReturnValue([{ method: 'setDelegatedOutcome', params: {} }]);
    const callback = vi.fn();
    await acceptTrustedSession(args(callback));

    expect(mutationRequestMock).toHaveBeenCalledTimes(1);
    const [{ methods, callback: mutationCallback }] = mutationRequestMock.mock.calls[0];
    expect(methods).toHaveLength(1);
    mutationCallback({ success: true });
    expect(callback).toHaveBeenCalledWith({ success: true, promoted: false });
    expect(toastKeys()).toEqual(['crowd.toast.promoteFailed']);
  });
});
