import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tournamentEngine } from 'tods-competition-factory';

/**
 * Server-first mutations and the offline queue (D1, 2026-10-08). A mutation made
 * offline waits in socketIo's queue; when its server-first timeout fires, the edit
 * is reported as failed, so the queued message must be withdrawn — otherwise the
 * reconnect would apply on the server what the UI said did not happen.
 */

const h = vi.hoisted(() => ({
  cancel: vi.fn(() => true),
  emitTmx: vi.fn(),
  reportSessionLost: vi.fn(),
  sessionValid: true,
  serverFirst: true,
}));

vi.mock('services/messaging/socketIo', () => ({ emitTmx: (...a: any[]) => h.emitTmx(...a) }));
vi.mock('services/session/sessionGuard', () => ({
  isSessionValid: () => h.sessionValid,
  reportSessionLost: (...a: any[]) => h.reportSessionLost(...a),
}));
vi.mock('services/staleness/stalenessGuard', () => ({ isStale: () => false, resetActivityTimer: vi.fn() }));
vi.mock('services/authentication/getUserContext', () => ({
  ensureUserContext: async () => ({ providerIds: ['prov-1'], isSuperAdmin: false }),
  getUserContext: () => undefined,
}));
vi.mock('services/authentication/loginState', () => ({
  getLoginState: () => ({ email: 'td@x.com' }),
  styleLogin: vi.fn(),
}));
vi.mock('services/storage/saveTournamentRecord', () => ({ saveTournamentRecord: vi.fn(async () => undefined) }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));
vi.mock('config/serverConfig', () => ({
  serverConfig: { get: () => ({ serverFirst: h.serverFirst, serverTimeout: 50 }) },
}));
vi.mock('config/debugConfig', () => ({ debugConfig: { get: () => ({}) } }));
vi.mock('config/providerConfig', () => ({ providerConfig: { get: () => ({ permissions: {} }) } }));
vi.mock('@courthive/provider-config', () => ({ isMutationAllowed: () => true }));
vi.mock('services/context', () => ({ context: {} }));
vi.mock('i18n', () => ({ t: (key: string) => key }));

import { mutationRequest, replayServerMutation } from './mutationRequest';

const tournamentRecord = () => ({
  tournamentId: 'tid-1',
  tournamentName: 'Open',
  startDate: '2026-01-01',
  endDate: '2099-12-31',
  parentOrganisation: { organisationId: 'prov-1' },
});

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('mutationRequest — server-first timeout and the offline queue', () => {
  beforeEach(() => {
    // makeMutation reads `window['dev']` for dev overrides; vitest here is the node environment.
    vi.stubGlobal('window', {});
    vi.useFakeTimers();
    h.cancel.mockClear();
    h.reportSessionLost.mockClear();
    h.emitTmx.mockReset().mockReturnValue({ cancel: h.cancel });
    h.sessionValid = true;
    h.serverFirst = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const request = (callback: any) =>
    mutationRequest({
      tournamentRecord: tournamentRecord(),
      methods: [{ method: 'setTournamentName', params: { tournamentName: 'Renamed' } }],
      callback,
    });

  it('settlements execute immediately and stay durable when local-first is configured', async () => {
    h.serverFirst = false;
    const execution = vi.spyOn(tournamentEngine, 'executionQueue').mockReturnValue({ success: true });
    const methods = [
      {
        method: 'settleRotatingPartnerResult',
        params: { drawId: 'd', requestId: 'r', recordedBy: 'client', recordedAt: 'old' },
      },
    ];
    await mutationRequest({ tournamentRecord: tournamentRecord(), methods, callback: vi.fn() });
    await settle();
    expect(execution).toHaveBeenCalledWith(methods, true);
    expect(h.emitTmx.mock.calls[0][0].durable).toBe(true);
    const appliedMethods = [
      {
        ...methods[0],
        params: { ...methods[0].params, recordedBy: 'verified-server-actor', recordedAt: '2026-10-10T12:00:00Z' },
      },
    ];
    h.emitTmx.mock.calls[0][0].ackCallback({ success: true, appliedMethods });
    await settle();
    expect(execution).toHaveBeenCalledTimes(1);
    expect(methods[0].params.recordedBy).toBe('client');
  });

  it('server-first presence attestations replay the canonical server attribution', async () => {
    h.serverFirst = true;
    const execution = vi.spyOn(tournamentEngine, 'executionQueue').mockReturnValue({ success: true });
    const methods = [
      {
        method: 'checkInParticipant',
        params: { participantId: 'p', attributedTo: { attributionType: 'USER', userId: 'client' } },
      },
    ];
    await mutationRequest({ tournamentRecord: tournamentRecord(), methods, callback: vi.fn() });
    await settle();
    const appliedMethods = [
      {
        method: 'checkInParticipant',
        params: { participantId: 'p', attributedTo: { attributionType: 'USER', userId: 'verified' } },
      },
    ];
    h.emitTmx.mock.calls[0][0].ackCallback({ success: true, appliedMethods });
    await settle();
    expect(execution).toHaveBeenCalledWith(appliedMethods, true);
    expect(methods[0].params.attributedTo.userId).toBe('client');
  });

  it('session-restored settlement replay uses the server-stamped command', async () => {
    h.serverFirst = true;
    // Replay now requires the operation to still own a loaded tournament.
    tournamentEngine.setState(tournamentRecord());
    const executionQueue = vi.fn(() => ({ success: true }));
    const methods = [
      {
        method: 'settleRotatingPartnerResult',
        params: { drawId: 'd', requestId: 'r', recordedBy: 'client', recordedAt: 'old' },
      },
    ];
    replayServerMutation({ methods, factoryEngine: { executionQueue }, tournamentIds: ['tid-1'] });
    const appliedMethods = [
      { ...methods[0], params: { ...methods[0].params, recordedBy: 'verified', recordedAt: '2026-10-10T12:00:00Z' } },
    ];
    h.emitTmx.mock.calls[0][0].ackCallback({ success: true, appliedMethods });
    await settle();
    expect(executionQueue).toHaveBeenCalledWith(appliedMethods, true);
  });

  it('withdraws the queued message when the timeout reports the edit as failed', async () => {
    const callback = vi.fn();
    await request(callback);
    await settle();
    expect(h.emitTmx).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60);

    expect(h.cancel).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ error: { message: 'toasts.serverNotResponding' } });
  });

  it('withdraws it on the session-lost path too, which replays the edit itself', async () => {
    h.sessionValid = false;
    await request(vi.fn());
    await settle();

    vi.advanceTimersByTime(60);

    expect(h.cancel).toHaveBeenCalledTimes(1);
    expect(h.reportSessionLost).toHaveBeenCalledTimes(1);
  });

  it('leaves the message alone when the ack arrives in time', async () => {
    await request(vi.fn());
    await settle();
    const { ackCallback } = h.emitTmx.mock.calls[0][0];

    ackCallback({ success: true });
    vi.advanceTimersByTime(60);

    expect(h.cancel).not.toHaveBeenCalled();
  });
});
