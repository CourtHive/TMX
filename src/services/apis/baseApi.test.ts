import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory localStorage (vitest runs in Node).
const memStore: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memStore[k] ?? null,
  setItem: (k: string, v: string) => {
    memStore[k] = v;
  },
  removeItem: (k: string) => {
    delete memStore[k];
  },
});

// A single fake axios instance shared by every axios.create() call so the test
// can drive and assert against baseApi's internal instance. Declared via
// vi.hoisted so it exists when the (hoisted) vi.mock factory runs.
const { fakeInstance, post } = vi.hoisted(() => {
  const post = vi.fn();
  const fakeInstance: any = {
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    defaults: { headers: { common: {} }, baseURL: '' },
    post,
  };
  return { fakeInstance, post };
});
vi.mock('axios', () => ({ default: { create: () => fakeInstance }, create: () => fakeInstance }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));

import { authUrl, refreshAccessToken } from './baseApi';

beforeEach(() => {
  for (const k of Object.keys(memStore)) delete memStore[k];
  post.mockReset();
});

describe('baseApi.refreshAccessToken', () => {
  it('coalesces concurrent refreshes into one request and stores rotated tokens', async () => {
    localStorage.setItem('tmxRefreshToken', 'rtok_old');
    post.mockResolvedValue({ data: { token: 'access_new', refreshToken: 'rtok_new' } });

    const [a, b] = await Promise.all([refreshAccessToken(), refreshAccessToken()]);

    expect(a).toBe('access_new');
    expect(b).toBe('access_new');
    // Single-flight: a second concurrent caller must NOT trigger a second
    // rotation (which the server's reuse-detection would treat as theft).
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      '/auth/refresh',
      { refreshToken: 'rtok_old' },
      expect.objectContaining({ silenceErrors: true }),
    );
    expect(localStorage.getItem('tmxToken')).toBe('access_new');
    expect(localStorage.getItem('tmxRefreshToken')).toBe('rtok_new');
  });

  it('returns null and makes no request when there is no stored refresh token', async () => {
    const result = await refreshAccessToken();
    expect(result).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it('returns null when the refresh request fails (does not throw)', async () => {
    localStorage.setItem('tmxRefreshToken', 'rtok_old');
    post.mockRejectedValue(new Error('401'));
    const result = await refreshAccessToken();
    expect(result).toBeNull();
    // The stale access token is left untouched for the caller to handle (logout).
    expect(localStorage.getItem('tmxToken')).toBeNull();
  });

  it('reports a refused refresh by its status and message, not as a destructuring error', async () => {
    localStorage.setItem('tmxRefreshToken', 'rtok_old');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    post.mockResolvedValue({ status: 401, data: { message: 'Refresh token reused' } });

    const result = await refreshAccessToken();

    expect(result).toBeNull();
    // the refresh must resolve on any status, or the error interceptor hands back `undefined` instead
    expect(post).toHaveBeenCalledWith(
      '/auth/refresh',
      { refreshToken: 'rtok_old' },
      expect.objectContaining({ validateStatus: expect.any(Function) }),
    );
    expect(warn).toHaveBeenCalledWith(
      '[baseApi] performRefresh: server rejected refresh status=401 message=Refresh token reused',
    );
    expect(localStorage.getItem('tmxToken')).toBeNull();
    warn.mockRestore();
  });

  it('survives the error interceptor resolving a refused refresh to undefined', async () => {
    localStorage.setItem('tmxRefreshToken', 'rtok_old');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    post.mockResolvedValue(undefined);

    const result = await refreshAccessToken();

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      '[baseApi] performRefresh: server rejected refresh status=undefined message=no response',
    );
    warn.mockRestore();
  });

  it('allows a fresh refresh after the previous one settled (flight resets)', async () => {
    localStorage.setItem('tmxRefreshToken', 'rtok_old');
    post.mockResolvedValueOnce({ data: { token: 'a1', refreshToken: 'r1' } });
    await refreshAccessToken();
    post.mockResolvedValueOnce({ data: { token: 'a2', refreshToken: 'r2' } });
    const second = await refreshAccessToken();
    expect(second).toBe('a2');
    expect(post).toHaveBeenCalledTimes(2);
  });
});

describe('baseApi.authUrl', () => {
  const original = process.env.AUTH_SERVER;
  const restore = () => {
    if (original === undefined) delete process.env.AUTH_SERVER;
    else process.env.AUTH_SERVER = original;
  };

  it('returns the path unchanged when AUTH_SERVER is empty (production: same origin, nginx routes it)', () => {
    process.env.AUTH_SERVER = '';
    expect(authUrl('/auth/login')).toBe('/auth/login');
    restore();
  });

  it('prefixes the identity provider origin when AUTH_SERVER is set (development: hiveid on its own port)', () => {
    process.env.AUTH_SERVER = 'http://localhost:3140';
    expect(authUrl('/auth/me')).toBe('http://localhost:3140/auth/me');
    restore();
  });
});
