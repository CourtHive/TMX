import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
vi.mock('config/serverConfig', () => ({ serverConfig: { get: () => ({ serverFirst: true, serverTimeout: 50 }) } }));
vi.mock('config/debugConfig', () => ({ debugConfig: { get: () => ({}) } }));
vi.mock('config/providerConfig', () => ({ providerConfig: { get: () => ({ permissions: {} }) } }));
vi.mock('@courthive/provider-config', () => ({ isMutationAllowed: () => true }));
vi.mock('services/context', () => ({ context: {} }));
vi.mock('i18n', () => ({ t: (key: string) => key }));

import { mutationRequest } from './mutationRequest';

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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const request = (callback: any) =>
    mutationRequest({
      tournamentRecord: tournamentRecord(),
      methods: [{ method: 'setTournamentName', params: { tournamentName: 'Renamed' } }],
      callback,
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
