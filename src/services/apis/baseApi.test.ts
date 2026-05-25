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

import { refreshAccessToken } from './baseApi';

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
    expect(post).toHaveBeenCalledWith('/auth/refresh', { refreshToken: 'rtok_old' }, expect.objectContaining({ silenceErrors: true }));
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
