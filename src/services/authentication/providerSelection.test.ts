import { describe, expect, it, vi } from 'vitest';

const selectProvider = vi.fn();
vi.mock('./authApi', () => ({ selectProvider: (...args: any[]) => selectProvider(...args) }));
vi.mock('services/notifications/tmxToast', () => ({ tmxToast: vi.fn() }));

import { exchangeForProviderSession, isProviderSelectionResponse, pickerProviders } from './providerSelection';

const SELECTION_TOKEN = 'selection-token';

describe('provider selection at login', () => {
  it('recognises a multi-provider login answer, and not a session', () => {
    expect(isProviderSelectionResponse({ providerSelectionRequired: true, providers: [], selectionToken: 'sel' })).toBe(
      true,
    );
    expect(isProviderSelectionResponse({ token: 'jwt', refreshToken: 'rt' })).toBe(false);
    // a session token carrying the flag is handled from its claims, not as a login answer
    expect(isProviderSelectionResponse({ providerSelectionRequired: true, token: 'jwt' })).toBe(false);
  });

  it("exchanges the bearer for the chosen provider's session", async () => {
    selectProvider.mockResolvedValueOnce({ data: { token: 'jwt-league', refreshToken: 'rt' } });
    const session = await exchangeForProviderSession('league', SELECTION_TOKEN);
    expect(selectProvider).toHaveBeenCalledWith('league', SELECTION_TOKEN);
    expect(session).toEqual({ token: 'jwt-league', refreshToken: 'rt' });
  });

  it('answers undefined when the server refuses, so no session is started', async () => {
    selectProvider.mockResolvedValueOnce(undefined);
    expect(await exchangeForProviderSession('elsewhere', SELECTION_TOKEN)).toBeUndefined();
    selectProvider.mockRejectedValueOnce(new Error('403'));
    expect(await exchangeForProviderSession('elsewhere', SELECTION_TOKEN)).toBeUndefined();
  });

  it('a session that has not chosen offers the list HiveID put on it, including providers reached through a provisioner', () => {
    const login = {
      providerAssociations: [{ providerId: 'club' }, { providerId: 'league' }],
      choosableProviders: [
        { providerId: 'club' },
        { providerId: 'league' },
        { providerId: 'boca', viaProvisioner: true },
      ],
    };
    expect(pickerProviders(login).map((p) => p.providerId)).toEqual(['club', 'league', 'boca']);
  });

  it('a token issued before HiveID listed them still offers its direct associations', () => {
    expect(pickerProviders({ providerAssociations: [{ providerId: 'club' }] }).map((p) => p.providerId)).toEqual([
      'club',
    ]);
    expect(pickerProviders(undefined)).toEqual([]);
  });
});
