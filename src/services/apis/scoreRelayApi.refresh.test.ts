/**
 * The relay's 401 handling (2026-11-08). The relay verifies the same access token as CFS but had no refresh path, so
 * an access token that expired while TMX made no CFS REST call 401'd every relay request — the crowd poller every 45s.
 *
 * A 401 for an EXPIRED token is retried once (with a token another path already refreshed, else after baseApi's
 * single-flight refresh). A 401 for a LIVE token is not an expiry, so it is surfaced without rotating the refresh token.
 * The axios instance is faked so the registered interceptor can be invoked directly; jwt-decode is real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const memStore: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memStore[k] ?? null,
  setItem: (k: string, v: string) => {
    memStore[k] = v;
  },
  removeItem: (k: string) => {
    delete memStore[k];
  },
  clear: () => {
    for (const k of Object.keys(memStore)) delete memStore[k];
  },
});

const { fakeInstance, refreshAccessToken } = vi.hoisted(() => {
  const instance: any = vi.fn();
  instance.interceptors = { request: { use: vi.fn() }, response: { use: vi.fn() } };
  instance.defaults = { headers: { common: {} }, baseURL: '' };
  return { fakeInstance: instance, refreshAccessToken: vi.fn() };
});
vi.mock('axios', () => ({ default: { create: () => fakeInstance } }));
vi.mock('services/apis/baseApi', () => ({ refreshAccessToken: () => refreshAccessToken() }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));
vi.mock('config/serverConfig', () => ({ serverConfig: { get: () => ({ socketPath: 'http://localhost:8383' }) } }));
vi.mock('config/providerConfig', () => ({ providerConfig: { get: () => ({}) } }));
vi.mock('i18n', () => ({ t: (k: string) => k }));

import { getJwtTokenStorageKey } from 'config/localStorage';
import './scoreRelayApi';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (expSecondsFromNow: number) =>
  `${b64({ alg: 'ES256', typ: 'JWT' })}.${b64({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })}.sig`;
const EXPIRED = jwt(-600);
const LIVE = jwt(3600);
const FRESH = jwt(7200);

// Captured at load: the config's clearMocks wipes the registration call before each test.
const rejectedHandler = fakeInstance.interceptors.response.use.mock.calls[0][1];
const onRejected = () => rejectedHandler;
const refused = (token: string, extra: any = {}) => ({
  response: { status: 401, data: { error: 'expired' } },
  config: { url: '/api/crowd-sessions', headers: { Authorization: `Bearer ${token}` }, silenceErrors: true, ...extra },
});

describe('scoreRelayApi — 401 for an expired access token', () => {
  beforeEach(() => {
    for (const k of Object.keys(memStore)) delete memStore[k];
    fakeInstance.mockReset().mockResolvedValue({ status: 200, data: { sessions: [] } });
    refreshAccessToken.mockReset();
  });

  it('refreshes once and retries with the new token', async () => {
    memStore[getJwtTokenStorageKey()] = EXPIRED;
    refreshAccessToken.mockResolvedValue(FRESH);

    const result = await onRejected()(refused(EXPIRED));

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fakeInstance).toHaveBeenCalledTimes(1);
    const retried = fakeInstance.mock.calls[0][0];
    expect(retried.headers.Authorization).toBe(`Bearer ${FRESH}`);
    expect(retried._retried).toBe(true);
    expect(result).toEqual({ status: 200, data: { sessions: [] } });
  });

  it('retries with a token another path already refreshed, without refreshing again', async () => {
    memStore[getJwtTokenStorageKey()] = FRESH;

    await onRejected()(refused(EXPIRED));

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(fakeInstance.mock.calls[0][0].headers.Authorization).toBe(`Bearer ${FRESH}`);
  });

  it('does not refresh for a live token — a refresh cannot fix that refusal', async () => {
    memStore[getJwtTokenStorageKey()] = LIVE;
    const error = refused(LIVE);

    await expect(onRejected()(error)).rejects.toBe(error);
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(fakeInstance).not.toHaveBeenCalled();
  });

  it('surfaces the refusal when the refresh fails', async () => {
    memStore[getJwtTokenStorageKey()] = EXPIRED;
    refreshAccessToken.mockResolvedValue(null);
    const error = refused(EXPIRED);

    await expect(onRejected()(error)).rejects.toBe(error);
    expect(fakeInstance).not.toHaveBeenCalled();
  });

  it('never retries a retry: the second 401 is surfaced, with one refresh in total', async () => {
    memStore[getJwtTokenStorageKey()] = EXPIRED;
    const error = refused(EXPIRED, { _retried: true });

    await expect(onRejected()(error)).rejects.toBe(error);
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });
});
