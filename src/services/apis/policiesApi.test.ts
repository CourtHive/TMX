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
vi.stubGlobal('location', { host: 'localhost:5173', hostname: 'localhost', origin: 'http://localhost:5173' });

import { fetchMyPolicies, fetchPolicyCatalog } from './policiesApi';
import { getJwtTokenStorageKey } from 'config/localStorage';

/**
 * The two audiences are the point of this module, and they differ in one observable way: whether an
 * Authorization header is sent. A demo session has no token; a logged-in one does, and must not be
 * served only the anonymous catalog when its provider has policies of its own.
 */

function mockFetch(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status, json: async () => body });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  for (const k of Object.keys(memStore)) delete memStore[k];
});

describe('policiesApi', () => {
  it('fetchPolicyCatalog sends NO Authorization header, even when a token is present', async () => {
    localStorage.setItem(getJwtTokenStorageKey(), 'a-token');
    const fetchMock = mockFetch({ policies: [{ policyId: 'p1' }] });

    const policies = await fetchPolicyCatalog();

    expect(policies).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://localhost:3130/policies/catalog');
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('fetchMyPolicies sends the session token, and asks the provider-scoped route', async () => {
    localStorage.setItem(getJwtTokenStorageKey(), 'a-token');
    const fetchMock = mockFetch({ policies: [] });

    await fetchMyPolicies();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://localhost:3130/policies');
    expect(init.headers.Authorization).toBe('Bearer a-token');
  });

  it('omits Authorization when no token is stored rather than sending "Bearer null"', async () => {
    const fetchMock = mockFetch({ policies: [] });
    await fetchMyPolicies();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('returns [] for a body without a policies array, rather than undefined', async () => {
    mockFetch({});
    await expect(fetchPolicyCatalog()).resolves.toEqual([]);
  });

  it('throws with the status so a caller can tell "down" from "empty"', async () => {
    mockFetch({}, false, 503);
    await expect(fetchPolicyCatalog()).rejects.toThrow('HTTP 503');
  });

  it('forwards an AbortSignal so a page leaving mid-flight can cancel', async () => {
    const fetchMock = mockFetch({ policies: [] });
    const controller = new AbortController();
    await fetchPolicyCatalog(controller.signal);
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });
});
