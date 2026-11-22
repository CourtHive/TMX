import { describe, expect, it, vi, beforeEach } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('services/apis/baseApi', () => ({ baseApi: { get }, authUrl: (path: string) => path }));
import { fetchSupportCapability } from './reportApi';

describe('fetchSupportCapability', () => {
  beforeEach(() => get.mockReset());

  it('asks CFS with the selected provider and handles its refusal inline', async () => {
    get.mockResolvedValue({ data: { available: true, scope: 'provider', providerId: 'p/1' } });
    await expect(fetchSupportCapability('p/1')).resolves.toMatchObject({ scope: 'provider', providerId: 'p/1' });
    expect(get).toHaveBeenLastCalledWith('/support/capability?provider=p%2F1', { rejectErrors: true });
    get.mockResolvedValue({ data: { available: true, scope: 'platform' } });
    await fetchSupportCapability(undefined);
    expect(get).toHaveBeenLastCalledWith('/support/capability', { rejectErrors: true });
  });

  it('refuses an answer that does not say whether feedback is available', async () => {
    get.mockResolvedValue({ data: {} }); // e.g. a catch-all stub, never "available"
    await expect(fetchSupportCapability()).rejects.toThrow('capability-unavailable');
  });
});
