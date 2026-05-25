import { beforeEach, describe, expect, it, vi } from 'vitest';

// Vitest runs in Node by default — localStorage isn't defined. Stub a simple
// in-memory implementation so the token helpers have somewhere to read/write.
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

import {
  getToken,
  setToken,
  removeToken,
  getRefreshToken,
  setRefreshToken,
  removeRefreshToken,
} from './tokenManagement';

beforeEach(() => {
  for (const k of Object.keys(memStore)) delete memStore[k];
});

describe('tokenManagement refresh-token helpers', () => {
  it('stores the refresh token under a distinct key from the access token', () => {
    setToken('access-1');
    setRefreshToken('rtok-1');
    expect(getToken()).toBe('access-1');
    expect(getRefreshToken()).toBe('rtok-1');
    expect(memStore.tmxToken).toBe('access-1');
    expect(memStore.tmxRefreshToken).toBe('rtok-1');
  });

  it('returns null when no refresh token is stored', () => {
    expect(getRefreshToken()).toBeNull();
  });

  it('removing the refresh token leaves the access token intact', () => {
    setToken('access-1');
    setRefreshToken('rtok-1');
    removeRefreshToken();
    expect(getRefreshToken()).toBeNull();
    expect(getToken()).toBe('access-1');
  });

  it('removing the access token leaves the refresh token intact', () => {
    setToken('access-1');
    setRefreshToken('rtok-1');
    removeToken();
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBe('rtok-1');
  });
});
