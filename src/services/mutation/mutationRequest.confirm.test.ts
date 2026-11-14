import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tournamentEngine } from 'tods-competition-factory';

/**
 * A mutationRequest caller holds its busy/saving state until the callback fires, so the callback
 * must fire exactly once on every path — including a confirmation prompt (out of date range,
 * super-admin impersonation) whose confirmed mutation then throws, and a declined prompt.
 */

const h = vi.hoisted(() => ({
  emitTmx: vi.fn(),
  tmxToast: vi.fn(),
  userContext: vi.fn(),
}));

vi.mock('services/messaging/socketIo', () => ({ emitTmx: (...a: any[]) => h.emitTmx(...a) }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: (...a: any[]) => h.tmxToast(...a) }));
vi.mock('services/session/sessionGuard', () => ({ isSessionValid: () => true, reportSessionLost: vi.fn() }));
vi.mock('services/staleness/stalenessGuard', () => ({ isStale: () => false, resetActivityTimer: vi.fn() }));
vi.mock('services/authentication/getUserContext', () => ({
  ensureUserContext: () => h.userContext(),
  getUserContext: () => undefined,
}));
vi.mock('services/authentication/loginState', () => ({
  getLoginState: () => ({ email: 'td@x.com' }),
  styleLogin: vi.fn(),
}));
vi.mock('services/storage/saveTournamentRecord', () => ({ saveTournamentRecord: async () => undefined }));
vi.mock('services/authentication/sessionIdentity', () => ({ getSessionIdentity: () => 'td@x.com' }));
vi.mock('config/serverConfig', () => ({ serverConfig: { get: () => ({ serverFirst: true, serverTimeout: 50 }) } }));
vi.mock('config/debugConfig', () => ({ debugConfig: { get: () => ({}) } }));
vi.mock('config/providerConfig', () => ({
  providerConfig: { get: () => ({ permissions: {} }), effectivePermissions: () => ({}) },
}));
vi.mock('@courthive/provider-config', () => ({ isMutationAllowed: () => true }));
vi.mock('services/context', () => ({ context: {} }));
vi.mock('i18n', () => ({ t: (key: string) => key }));

import { mutationRequest } from './mutationRequest';
import { context } from 'services/context';

const record = (endDate: string) => ({
  tournamentId: 'tid-1',
  tournamentName: 'Open',
  startDate: '2020-01-01',
  endDate,
  parentOrganisation: { organisationId: 'prov-1' },
});
const PAST = '2020-01-31';
const FUTURE = '2099-12-31';
const TRANSPORT_FAILURE = 'transport exploded';
const methods = [{ method: 'setTournamentName', params: { tournamentName: 'Edited' } }];

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/** The prompt mutationRequest raised: its confirm action and its onClose, as the toaster would run them. */
function prompt(): { confirm: () => unknown; dismiss: () => void } {
  const params = h.tmxToast.mock.calls.find(([p]) => p?.action)?.[0];
  if (!params) throw new Error('no confirmation prompt was raised');
  return { confirm: () => params.action.onClick(), dismiss: () => params.onClose?.() };
}

describe('mutationRequest confirmation prompts complete the caller', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
    h.emitTmx.mockReset();
    h.tmxToast.mockReset();
    h.userContext.mockReset().mockResolvedValue({ providerIds: ['prov-1'], isSuperAdmin: false });
    delete (context as any).provider;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('calls back once with an error when an out-of-range edit is confirmed and the mutation throws', async () => {
    tournamentEngine.setState(record(PAST));
    h.emitTmx.mockImplementation(() => {
      throw new Error(TRANSPORT_FAILURE);
    });
    const done = vi.fn();
    await mutationRequest({ methods, callback: done });
    expect(done).not.toHaveBeenCalled();

    const { confirm, dismiss } = prompt();
    confirm();
    dismiss(); // the confirm click bubbles to the toast, which closes it
    await settle();

    expect(done).toHaveBeenCalledTimes(1);
    expect(done.mock.calls[0][0].error.message).toBe(TRANSPORT_FAILURE);
  });

  it('calls back once with an error when an out-of-range edit is confirmed and the permission check throws', async () => {
    tournamentEngine.setState(record(PAST));
    h.userContext.mockRejectedValue(new Error('auth/me unreachable'));
    const done = vi.fn();
    await mutationRequest({ methods, callback: done });

    prompt().confirm();
    await settle();

    expect(done).toHaveBeenCalledTimes(1);
    expect(done.mock.calls[0][0].error.message).toBe('auth/me unreachable');
    expect(h.emitTmx).not.toHaveBeenCalled();
  });

  it('calls back once with an error when super-admin impersonation is confirmed and the mutation throws', async () => {
    tournamentEngine.setState(record(FUTURE));
    h.userContext.mockResolvedValue({ providerIds: [], isSuperAdmin: true });
    h.emitTmx.mockImplementation(() => {
      throw new Error(TRANSPORT_FAILURE);
    });
    const done = vi.fn();
    await mutationRequest({ methods, callback: done });
    await settle();
    expect(done).not.toHaveBeenCalled();

    const { confirm, dismiss } = prompt();
    confirm();
    dismiss();
    await settle();

    expect(done).toHaveBeenCalledTimes(1);
    expect(done.mock.calls[0][0].error.message).toBe(TRANSPORT_FAILURE);
  });

  it('resolves and calls back with an error when an unprompted local mutation throws', async () => {
    const { parentOrganisation, ...local } = record(FUTURE);
    expect(parentOrganisation).toBeDefined();
    tournamentEngine.setState(local);
    const execute = vi.spyOn(tournamentEngine, 'executionQueue').mockImplementation(() => {
      throw new Error('local engine failed');
    });
    try {
      const done = vi.fn();
      await expect(mutationRequest({ methods, callback: done })).resolves.toBeUndefined();

      expect(done).toHaveBeenCalledTimes(1);
      expect(done.mock.calls[0][0].error.message).toBe('local engine failed');
      expect(h.tmxToast).not.toHaveBeenCalled();
    } finally {
      execute.mockRestore();
    }
  });

  it('still surfaces a callback that throws, rather than calling it a second time', async () => {
    const { parentOrganisation, ...local } = record(FUTURE);
    expect(parentOrganisation).toBeDefined();
    tournamentEngine.setState(local);
    const done = vi.fn(() => {
      throw new Error('caller bug');
    });
    await expect(mutationRequest({ methods, callback: done })).rejects.toThrow('caller bug');
    expect(done).toHaveBeenCalledTimes(1);
  });

  // Pins of existing behavior: a declined prompt completes through its onClose, exactly once; the
  // toaster runs onClose on every dismissal (duration timer, click, close button).
  it('calls back once with the date-range refusal when the out-of-range prompt is dismissed', async () => {
    tournamentEngine.setState(record(PAST));
    const done = vi.fn();
    await mutationRequest({ methods, callback: done });

    const { dismiss } = prompt();
    dismiss();
    dismiss(); // the duration timer can still fire after a click close
    await settle();

    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith({ error: { message: 'toasts.notInDateRange' } });
    expect(h.emitTmx).not.toHaveBeenCalled();
  });

  it('calls back once with the authorization refusal when impersonation is declined', async () => {
    tournamentEngine.setState(record(FUTURE));
    h.userContext.mockResolvedValue({ providerIds: [], isSuperAdmin: true });
    const done = vi.fn();
    await mutationRequest({ methods, callback: done });
    await settle();

    prompt().dismiss();
    await settle();

    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith({ error: { message: 'toasts.notAuthorized' } });
    expect(h.emitTmx).not.toHaveBeenCalled();
  });
});
