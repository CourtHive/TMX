import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('platform', () => ({
  platform: { getDefaultServerUrl: () => 'https://courthive.net' },
}));

import { getProviderRankingsUrl, providerHasRankings } from './providerRankings';

const bundle = (abbreviation: string, withRankings = true) => ({
  provider: { name: abbreviation, abbreviation },
  rankings: withRankings ? { men: [], women: [] } : undefined,
});

function mockFetch(response: { ok: boolean; json?: () => any }) {
  const fn = vi.fn().mockResolvedValue({
    ok: response.ok,
    json: response.json ?? (() => ({})),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('getProviderRankingsUrl', () => {
  it('builds the public viewer URL with an upper-cased abbreviation', () => {
    expect(getProviderRankingsUrl('boboca')).toBe('https://courthive.net/pub/#/rankings/BOBOCA');
  });
});

describe('providerHasRankings', () => {
  it('returns true when the bundle abbreviation matches and rankings are present', async () => {
    mockFetch({ ok: true, json: () => bundle('BOBOCA') });
    expect(await providerHasRankings('BOBOCA')).toBe(true);
  });

  it('returns false when the bundle is for a different provider', async () => {
    mockFetch({ ok: true, json: () => bundle('BOBOCA') });
    expect(await providerHasRankings('TYPTI')).toBe(false);
  });

  it('returns false when the matching bundle has no rankings', async () => {
    mockFetch({ ok: true, json: () => bundle('NORANK', false) });
    expect(await providerHasRankings('NORANK')).toBe(false);
  });

  it('returns false without an abbreviation and never calls the proxy', async () => {
    const fn = mockFetch({ ok: true, json: () => bundle('ANY') });
    expect(await providerHasRankings(undefined)).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it('returns false when the proxy request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('unreachable')),
    );
    expect(await providerHasRankings('DOWNP')).toBe(false);
  });

  it('memoizes the result per provider so the proxy is hit once', async () => {
    const fn = mockFetch({ ok: true, json: () => bundle('CACHED') });
    await providerHasRankings('CACHED');
    await providerHasRankings('cached');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
