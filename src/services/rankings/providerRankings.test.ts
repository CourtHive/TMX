import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('platform', () => ({
  platform: { getDefaultServerUrl: () => 'https://courthive.net' },
}));

// The module memoizes the provider list in a module-level promise, so each
// test re-imports it fresh to isolate the cache.
async function freshModule() {
  vi.resetModules();
  return import('./providerRankings');
}

function mockFetch(response: { ok: boolean; json?: () => any }) {
  const fn = vi.fn().mockResolvedValue({
    ok: response.ok,
    json: response.json ?? (() => []),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const providers = [
  { abbreviation: 'BOBOCA', name: 'Battle of Boca' },
  { abbreviation: 'TYPTI', name: 'Tennis Europe' },
];

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('getProviderRankingsUrl', () => {
  it('builds the public viewer URL with an upper-cased abbreviation', async () => {
    const { getProviderRankingsUrl } = await freshModule();
    expect(getProviderRankingsUrl('boboca')).toBe('https://courthive.net/pub/#/rankings/BOBOCA');
  });
});

describe('providerHasRankings', () => {
  it('returns true when the provider is in the directory (case-insensitive)', async () => {
    mockFetch({ ok: true, json: () => providers });
    const { providerHasRankings } = await freshModule();
    expect(await providerHasRankings('boboca')).toBe(true);
    expect(await providerHasRankings('TYPTI')).toBe(true);
  });

  it('returns false when the provider is not in the directory', async () => {
    mockFetch({ ok: true, json: () => providers });
    const { providerHasRankings } = await freshModule();
    expect(await providerHasRankings('NOPE')).toBe(false);
  });

  it('returns false without an abbreviation and never calls the proxy', async () => {
    const fn = mockFetch({ ok: true, json: () => providers });
    const { providerHasRankings } = await freshModule();
    expect(await providerHasRankings(undefined)).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it('returns false when the directory request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unreachable')));
    const { providerHasRankings } = await freshModule();
    expect(await providerHasRankings('BOBOCA')).toBe(false);
  });

  it('fetches the directory once and reuses it across probes', async () => {
    const fn = mockFetch({ ok: true, json: () => providers });
    const { providerHasRankings } = await freshModule();
    await providerHasRankings('BOBOCA');
    await providerHasRankings('TYPTI');
    await providerHasRankings('NOPE');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
