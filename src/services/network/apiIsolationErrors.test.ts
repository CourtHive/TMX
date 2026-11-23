import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from 'services/apis/baseApi';
import { scoreRelayApi } from 'services/apis/scoreRelayApi';
import { setNetworkIsolation } from './networkPolicy';
import { serverFetch } from './serverNetwork';

vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));
vi.mock('platform', () => ({ platform: { isDesktop: () => false, getDefaultServerUrl: () => '' } }));

afterEach(() => {
  setNetworkIsolation(false);
  vi.unstubAllGlobals();
});

describe('application API isolation contract', () => {
  it('baseApi, score relay and fetch all reject rather than resolve undefined', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const adapter = vi.fn(async (config) => ({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }));
    baseApi.defaults.adapter = adapter;
    scoreRelayApi.defaults.adapter = adapter;
    setNetworkIsolation(true);
    for (const request of [baseApi.get('/factory'), scoreRelayApi.get('/relay'), serverFetch('/query')])
      await expect(request).rejects.toMatchObject({ code: 'NETWORK_ISOLATED', reason: 'active' });
    expect(adapter).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    setNetworkIsolation(false);
    await expect(
      baseApi.post('/factory', { tournamentId: 'production', tournamentName: 'time-warp-cup' }),
    ).resolves.toMatchObject({ data: { success: true } });
    await expect(scoreRelayApi.post('/relay', { notes: 'time-warp-cup' })).resolves.toMatchObject({
      data: { success: true },
    });
  });
});
