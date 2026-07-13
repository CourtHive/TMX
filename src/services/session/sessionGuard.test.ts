import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getLoginState: vi.fn(),
  attemptSilentRefresh: vi.fn(),
  getToken: vi.fn(),
  getRefreshToken: vi.fn(),
  reconnectSocket: vi.fn(),
  onSocketReconnect: vi.fn(),
  loginModal: vi.fn(),
  buildInlineNotice: vi.fn(() => ({ id: '', remove: vi.fn() })),
  getTournament: vi.fn(() => ({ tournamentRecord: { parentOrganisation: { organisationId: 'prov-1' } } })),
  reconnectListeners: [] as Array<() => void>,
}));

vi.mock('services/authentication/loginState', () => ({
  getLoginState: h.getLoginState,
  attemptSilentRefresh: h.attemptSilentRefresh,
}));
vi.mock('services/authentication/tokenManagement', () => ({
  getToken: h.getToken,
  getRefreshToken: h.getRefreshToken,
}));
vi.mock('services/messaging/socketIo', () => ({
  reconnectSocket: h.reconnectSocket,
  onSocketReconnect: h.onSocketReconnect,
}));
vi.mock('components/notices/inlineNotice', () => ({ buildInlineNotice: h.buildInlineNotice }));
vi.mock('components/modals/loginModal', () => ({ loginModal: h.loginModal }));
vi.mock('services/factory/engine', () => ({ tournamentEngine: { getTournament: h.getTournament } }));
vi.mock('i18n', () => ({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }));

import {
  isSessionValid,
  reportSessionLost,
  handleSocketException,
  notifySessionRecovered,
  isSessionBannerVisible,
  initSessionGuard,
  __resetSessionGuardForTest,
} from './sessionGuard';

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  h.reconnectListeners = [];
  h.onSocketReconnect.mockImplementation((l: () => void) => h.reconnectListeners.push(l));
  // Default: a valid session, provider work loaded, refresh token available.
  h.getLoginState.mockReturnValue({ email: 'user@x.com', exp: 9_999_999_999 });
  h.getToken.mockReturnValue('access-token');
  h.getRefreshToken.mockReturnValue('refresh-token');
  h.attemptSilentRefresh.mockResolvedValue(true);
  __resetSessionGuardForTest();
});

afterEach(() => {
  __resetSessionGuardForTest();
});

describe('isSessionValid', () => {
  it('mirrors getLoginState', () => {
    h.getLoginState.mockReturnValue({ email: 'a' });
    expect(isSessionValid()).toBe(true);
    h.getLoginState.mockReturnValue(undefined);
    expect(isSessionValid()).toBe(false);
  });
});

describe('handleSocketException — auth classification', () => {
  it('treats a token/expiry/unauthorized message as auth and shows the banner', () => {
    h.getLoginState.mockReturnValue(undefined);
    expect(handleSocketException({ message: 'Not logged in or token expired' })).toBe(true);
    expect(isSessionBannerVisible()).toBe(true);
  });

  it('recognizes an audience rejection', () => {
    h.getLoginState.mockReturnValue(undefined);
    expect(handleSocketException({ message: 'Token audience not accepted on this namespace' })).toBe(true);
  });

  it('does NOT treat an unrelated exception as auth (no banner)', () => {
    expect(handleSocketException({ message: 'Draw generation failed' })).toBe(false);
    expect(isSessionBannerVisible()).toBe(false);
  });

  it('accepts a bare string payload', () => {
    h.getLoginState.mockReturnValue(undefined);
    expect(handleSocketException('jwt malformed')).toBe(true);
  });
});

describe('reportSessionLost — recovery + edit preservation', () => {
  it('shows the banner and attempts silent refresh, then reconnects on success', async () => {
    h.getLoginState.mockReturnValue(undefined);
    reportSessionLost({ source: 'test' });
    expect(isSessionBannerVisible()).toBe(true);
    await flush();
    expect(h.attemptSilentRefresh).toHaveBeenCalledTimes(1);
    // Refresh succeeded → banner cleared + fresh-token reconnect forced.
    expect(h.reconnectSocket).toHaveBeenCalledTimes(1);
    expect(isSessionBannerVisible()).toBe(false);
  });

  it('keeps the banner up when silent refresh fails (no reconnect)', async () => {
    h.getLoginState.mockReturnValue(undefined);
    h.attemptSilentRefresh.mockResolvedValue(false);
    reportSessionLost({ source: 'test' });
    await flush();
    expect(h.reconnectSocket).not.toHaveBeenCalled();
    expect(isSessionBannerVisible()).toBe(true);
  });

  it('coalesces concurrent reports into a single recovery attempt', async () => {
    h.getLoginState.mockReturnValue(undefined);
    h.attemptSilentRefresh.mockReturnValue(new Promise(() => {})); // never resolves
    reportSessionLost({ source: 'a' });
    reportSessionLost({ source: 'b' });
    reportSessionLost({ source: 'c' });
    await flush();
    expect(h.attemptSilentRefresh).toHaveBeenCalledTimes(1);
  });

  it('preserves the retry and replays it on the next socket reconnect', () => {
    initSessionGuard();
    h.getLoginState.mockReturnValue(undefined);
    h.attemptSilentRefresh.mockResolvedValue(false); // don't auto-recover in this test
    const retry = vi.fn();
    reportSessionLost({ source: 'mutation', retry });
    expect(retry).not.toHaveBeenCalled();
    // Simulate the socket coming back — the flush listener registered at init runs.
    expect(h.reconnectListeners.length).toBe(1);
    h.reconnectListeners[0]();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('drains each preserved retry only once', () => {
    initSessionGuard();
    h.getLoginState.mockReturnValue(undefined);
    h.attemptSilentRefresh.mockResolvedValue(false);
    const retry = vi.fn();
    reportSessionLost({ source: 'mutation', retry });
    h.reconnectListeners[0]();
    h.reconnectListeners[0]();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe('notifySessionRecovered', () => {
  it('hides the banner and forces a fresh-token reconnect', () => {
    h.getLoginState.mockReturnValue(undefined);
    handleSocketException('token expired');
    expect(isSessionBannerVisible()).toBe(true);
    notifySessionRecovered();
    expect(isSessionBannerVisible()).toBe(false);
    expect(h.reconnectSocket).toHaveBeenCalled();
  });
});

describe('proactive watcher', () => {
  it('banners stranded provider work that cannot silently recover', () => {
    vi.useFakeTimers();
    try {
      initSessionGuard();
      // Session invalid, provider work loaded, and NO refresh token → unrecoverable.
      h.getLoginState.mockReturnValue(undefined);
      h.getRefreshToken.mockReturnValue(null);
      h.attemptSilentRefresh.mockResolvedValue(false);
      vi.advanceTimersByTime(30_000);
      expect(isSessionBannerVisible()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does NOT banner when a refresh token is still available (recovery in flight)', () => {
    vi.useFakeTimers();
    try {
      initSessionGuard();
      h.getLoginState.mockReturnValue(undefined);
      h.getRefreshToken.mockReturnValue('refresh-token'); // silent refresh can still recover
      vi.advanceTimersByTime(30_000);
      expect(isSessionBannerVisible()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does NOT banner when no provider work is loaded (e.g. deliberate logout)', () => {
    vi.useFakeTimers();
    try {
      initSessionGuard();
      h.getLoginState.mockReturnValue(undefined);
      h.getRefreshToken.mockReturnValue(null);
      h.getTournament.mockReturnValue({ tournamentRecord: undefined } as any); // no provider tournament
      vi.advanceTimersByTime(30_000);
      expect(isSessionBannerVisible()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
