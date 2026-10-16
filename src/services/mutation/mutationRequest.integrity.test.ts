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
  authorized: true,
  email: 'td@x.com',
  expired: false,
  saveLocal: false,
  save: vi.fn(async () => undefined),
}));

vi.mock('services/messaging/socketIo', () => ({ emitTmx: (...a: any[]) => h.emitTmx(...a) }));
vi.mock('services/session/sessionGuard', () => ({
  isSessionValid: () => h.sessionValid,
  reportSessionLost: (...a: any[]) => h.reportSessionLost(...a),
}));
vi.mock('services/staleness/stalenessGuard', () => ({ isStale: () => false, resetActivityTimer: vi.fn() }));
vi.mock('services/authentication/getUserContext', () => ({
  ensureUserContext: async () => ({ providerIds: h.authorized ? ['prov-1'] : [], isSuperAdmin: false }),
  getUserContext: () => undefined,
}));
vi.mock('services/authentication/loginState', () => ({
  getLoginState: () => (h.expired ? undefined : { email: h.email }),
  styleLogin: vi.fn(),
}));
vi.mock('services/storage/saveTournamentRecord', () => ({ saveTournamentRecord: () => h.save() }));
vi.mock('services/authentication/sessionIdentity', () => ({ getSessionIdentity: () => h.email }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));
vi.mock('config/serverConfig', () => ({
  serverConfig: { get: () => ({ serverFirst: h.serverFirst, serverTimeout: 50, saveLocal: h.saveLocal }) },
}));
vi.mock('config/debugConfig', () => ({ debugConfig: { get: () => ({}) } }));
vi.mock('config/providerConfig', () => ({ providerConfig: { get: () => ({ permissions: {} }) } }));
vi.mock('@courthive/provider-config', () => ({ isMutationAllowed: () => true }));
vi.mock('services/context', () => ({ context: {} }));
vi.mock('i18n', () => ({ t: (key: string) => key }));

import { markTournamentRecordInstalled } from 'services/tournament/operationOwnership';
import { toCommandOutcome } from 'services/messaging/transport/httpCommands';
import { setServerSync, serverIsAhead } from 'services/staleness/serverSync';
import { mutationRequest, replayServerMutation } from './mutationRequest';
import { onAuthoritativeRefreshRequired } from './mutationObservers';

const SYNC_BEFORE = '2026-10-15T10:00:00Z';
const SYNC_AFTER = '2026-10-15T10:01:00Z';
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

describe('mutation operation ownership and canonical HTTP answers', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
    h.reportSessionLost.mockReset();
    h.sessionValid = true;
    h.emitTmx.mockReset().mockReturnValue({ cancel: h.cancel });
    h.serverFirst = true;
    h.authorized = true;
    h.email = 'td@x.com';
    h.expired = false;
    h.saveLocal = false;
    h.save.mockReset().mockResolvedValue(undefined);
    tournamentEngine.setState(tournamentRecord());
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not apply a replay acknowledgement to another loaded tournament', async () => {
    const methods = [{ method: 'setTournamentName', params: { tournamentName: 'A edited' } }];
    replayServerMutation({ methods, factoryEngine: tournamentEngine, tournamentIds: ['tid-1'] });
    tournamentEngine.setState({ tournamentId: 'tid-2', tournamentName: 'B untouched' });
    h.emitTmx.mock.calls[0][0].ackCallback({ success: true });
    await settle();
    expect(tournamentEngine.getTournament().tournamentRecord?.tournamentName).toBe('B untouched');
  });

  it('applies server canonical methods from the HTTP response and only then advances sync', async () => {
    setServerSync('tid-1', SYNC_BEFORE);
    const done = vi.fn();
    await mutationRequest({
      methods: [{ method: 'setTournamentName', params: { tournamentName: 'Client name' } }],
      callback: done,
    });
    await settle();
    const canonical = [{ method: 'setTournamentName', params: { tournamentName: 'Server canonical name' } }];
    const answer = toCommandOutcome('ack-1', {
      status: 200,
      data: {
        success: true,
        appliedMethods: canonical,
        previousServerUpdatedAt: { 'tid-1': SYNC_BEFORE },
        serverUpdatedAt: { 'tid-1': SYNC_AFTER },
      },
    });
    h.emitTmx.mock.calls[0][0].ackCallback(answer.deliver!.payload);
    await settle();
    expect(tournamentEngine.getTournament().tournamentRecord?.tournamentName).toBe('Server canonical name');
    expect(serverIsAhead('tid-1', SYNC_AFTER)).toBe(false);
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
  it('completes a permission refusal so a bulk save can leave its in-flight state', async () => {
    h.authorized = false;
    const done = vi.fn();
    await mutationRequest({
      methods: [{ method: 'setTournamentName', params: { tournamentName: 'Refused' } }],
      callback: done,
    });
    await settle();
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ error: expect.anything() }));
    expect(h.emitTmx).not.toHaveBeenCalled();
  });

  it('does not apply an old user acknowledgement after identity changes over the same record', async () => {
    const done = vi.fn();
    await mutationRequest({
      methods: [{ method: 'setTournamentName', params: { tournamentName: 'Old user edit' } }],
      callback: done,
    });
    await settle();
    h.email = 'new-user@x.com';
    h.emitTmx.mock.calls[0][0].ackCallback({ success: true });
    await settle();
    expect(tournamentEngine.getTournament().tournamentRecord?.tournamentName).toBe('Open');
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ error: expect.anything() }));
  });
  it('replays for the restored same user over a freshly loaded copy of the original tournament', async () => {
    vi.useFakeTimers();
    h.sessionValid = false;
    await mutationRequest({ methods: [{ method: 'setTournamentName', params: { tournamentName: 'Restored edit' } }] });
    await settle();
    vi.advanceTimersByTime(60);
    expect(h.reportSessionLost).toHaveBeenCalledTimes(1);
    markTournamentRecordInstalled();
    h.sessionValid = true;
    h.reportSessionLost.mock.calls[0][0].retry();
    h.emitTmx.mock.calls[1][0].ackCallback({ success: true });
    await settle();
    expect(tournamentEngine.getTournament().tournamentRecord?.tournamentName).toBe('Restored edit');
  });

  it('applies a replay acknowledgement only once', async () => {
    const execute = vi.spyOn(tournamentEngine, 'executionQueue');
    try {
      replayServerMutation({
        methods: [{ method: 'setTournamentName', params: { tournamentName: 'Once' } }],
        factoryEngine: tournamentEngine,
        tournamentIds: ['tid-1'],
      });
      const acknowledge = h.emitTmx.mock.calls[0][0].ackCallback;
      acknowledge({ success: true });
      acknowledge({ success: true });
      await settle();
      expect(execute).toHaveBeenCalledTimes(1);
    } finally {
      execute.mockRestore();
    }
  });
  it('accepts a same-user acknowledgement during silent token refresh', async () => {
    const done = vi.fn();
    await mutationRequest({
      methods: [{ method: 'setTournamentName', params: { tournamentName: 'Applied' } }],
      callback: done,
    });
    await settle();
    h.expired = true;
    h.emitTmx.mock.calls[0][0].ackCallback({ success: true });
    await settle();
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(tournamentEngine.getTournament().tournamentRecord?.tournamentName).toBe('Applied');
  });
  it('completes after local persistence rejects an accepted server mutation', async () => {
    const done = vi.fn();
    h.saveLocal = true;
    h.save.mockRejectedValue(new Error('IndexedDB unavailable'));
    await mutationRequest({
      methods: [{ method: 'setTournamentName', params: { tournamentName: 'Applied' } }],
      callback: done,
    });
    await settle();
    h.emitTmx.mock.calls[0][0].ackCallback({ success: true });
    await settle();
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ success: true, persistenceError: expect.anything() }));
  });

  it('reconciles an accepted edit after a same-tournament reinstall without failing or applying twice', async () => {
    const done = vi.fn();
    await mutationRequest({
      methods: [{ method: 'setTournamentName', params: { tournamentName: 'Older ack' } }],
      callback: done,
    });
    await settle();
    tournamentEngine.setState({ ...tournamentRecord(), tournamentName: 'Fresh server copy' });
    markTournamentRecordInstalled();
    h.emitTmx.mock.calls[0][0].ackCallback({ success: true });
    await settle();
    expect(tournamentEngine.getTournament().tournamentRecord?.tournamentName).toBe('Fresh server copy');
    expect(done).toHaveBeenCalledWith({ success: true, refreshRequired: true });
  });
  it('completes and requires reconciliation if local engine application throws after server acceptance', async () => {
    const done = vi.fn();
    await mutationRequest({
      methods: [{ method: 'setTournamentName', params: { tournamentName: 'Accepted' } }],
      callback: done,
    });
    await settle();
    const execute = vi.spyOn(tournamentEngine, 'executionQueue').mockImplementationOnce(() => {
      throw new Error('local engine failed');
    });
    try {
      h.emitTmx.mock.calls[0][0].ackCallback({ success: true });
      await settle();
      expect(done).toHaveBeenCalledWith(expect.objectContaining({ success: true, refreshRequired: true }));
    } finally {
      execute.mockRestore();
    }
  });

  it('requests reconciliation when a local-first answer contains different canonical methods', async () => {
    h.serverFirst = false;
    const refresh = vi.fn();
    const unsubscribe = onAuthoritativeRefreshRequired(refresh);
    try {
      setServerSync('tid-1', SYNC_BEFORE);
      await mutationRequest({ methods: [{ method: 'setTournamentName', params: { tournamentName: 'Local' } }] });
      await settle();
      h.emitTmx.mock.calls[0][0].ackCallback({
        success: true,
        appliedMethods: [{ method: 'setTournamentName', params: { tournamentName: 'Canonical' } }],
        previousServerUpdatedAt: { 'tid-1': SYNC_BEFORE },
        serverUpdatedAt: { 'tid-1': SYNC_AFTER },
      });
      expect(tournamentEngine.getTournament().tournamentRecord?.tournamentName).toBe('Local');
      expect(serverIsAhead('tid-1', SYNC_AFTER)).toBe(true);
      expect(refresh).toHaveBeenCalledWith(['tid-1']);
    } finally {
      unsubscribe();
    }
  });
  it('keeps a mutation owned when it starts during refresh and the token becomes valid before ack', async () => {
    h.expired = true;
    const done = vi.fn();
    await mutationRequest({
      methods: [{ method: 'setTournamentName', params: { tournamentName: 'Refreshed' } }],
      callback: done,
    });
    await settle();
    h.expired = false;
    h.emitTmx.mock.calls[0][0].ackCallback({ success: true });
    await settle();
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(tournamentEngine.getTournament().tournamentRecord?.tournamentName).toBe('Refreshed');
  });
});
