import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks must be declared before importing the module under test.
vi.mock('services/context', () => ({ context: { provider: undefined } }));
vi.mock('services/authentication/loginState', () => ({ getLoginState: vi.fn() }));

import { getLoginState } from 'services/authentication/loginState';
import { isActiveProviderAdmin } from './isProviderAdmin';
import { context } from 'services/context';

import type { LoginState } from 'types/tmx';

const mockedGetLoginState = vi.mocked(getLoginState);
const BOBOCA = 'boboca-id';
const ION = 'ion-id';

const login = (overrides: Partial<LoginState> = {}): LoginState =>
  ({ email: 'u@x.com', roles: [], permissions: [], services: [], exp: 0, ...overrides }) as LoginState;

const providerAdminAt = (providerId: string) => ({
  providerId,
  providerRole: 'PROVIDER_ADMIN',
  organisationName: providerId,
  organisationAbbreviation: providerId,
});

const provider = (organisationId: string) => ({ organisationId, organisationName: '', organisationAbbreviation: '' });

beforeEach(() => {
  context.provider = undefined;
  mockedGetLoginState.mockReset();
});

describe('isActiveProviderAdmin', () => {
  it('is false when not logged in', () => {
    mockedGetLoginState.mockReturnValue(undefined);
    expect(isActiveProviderAdmin()).toBe(false);
  });

  it('is true for super-admin even with no active provider', () => {
    mockedGetLoginState.mockReturnValue(login({ roles: ['superadmin'] }));
    expect(isActiveProviderAdmin()).toBe(true);
  });

  it('is true for a provisioner whose managed provider is active', () => {
    context.provider = provider(BOBOCA);
    mockedGetLoginState.mockReturnValue(
      login({
        roles: ['provisioner'],
        provisionerProviders: [{ providerId: BOBOCA, organisationName: 'BOBOCA', organisationAbbreviation: 'BOBOCA' }],
      }),
    );
    expect(isActiveProviderAdmin()).toBe(true);
  });

  it('is false for a provisioner when the active provider is NOT one they manage', () => {
    context.provider = provider(ION);
    mockedGetLoginState.mockReturnValue(
      login({
        roles: ['provisioner'],
        provisionerProviders: [{ providerId: BOBOCA, organisationName: 'BOBOCA', organisationAbbreviation: 'BOBOCA' }],
      }),
    );
    expect(isActiveProviderAdmin()).toBe(false);
  });

  it('is true for a PROVIDER_ADMIN at the active provider (no global admin role)', () => {
    context.provider = provider(BOBOCA);
    mockedGetLoginState.mockReturnValue(login({ roles: ['client'], providerAssociations: [providerAdminAt(BOBOCA)] }));
    expect(isActiveProviderAdmin()).toBe(true);
  });

  it('is false when PROVIDER_ADMIN is at a different provider than the active one', () => {
    context.provider = provider(ION);
    mockedGetLoginState.mockReturnValue(login({ roles: ['client'], providerAssociations: [providerAdminAt(BOBOCA)] }));
    expect(isActiveProviderAdmin()).toBe(false);
  });

  it('is false for a DIRECTOR at the active provider', () => {
    context.provider = provider(BOBOCA);
    mockedGetLoginState.mockReturnValue(
      login({
        roles: ['client'],
        providerAssociations: [
          { providerId: BOBOCA, providerRole: 'DIRECTOR', organisationName: 'BOBOCA', organisationAbbreviation: 'BOBOCA' },
        ],
      }),
    );
    expect(isActiveProviderAdmin()).toBe(false);
  });

  it('honors the deprecated global admin role when a provider is active', () => {
    context.provider = provider(ION);
    mockedGetLoginState.mockReturnValue(login({ roles: ['client', 'admin'] }));
    expect(isActiveProviderAdmin()).toBe(true);
  });

  it('does NOT grant the deprecated global admin role with no active provider', () => {
    mockedGetLoginState.mockReturnValue(login({ roles: ['client', 'admin'] }));
    expect(isActiveProviderAdmin()).toBe(false);
  });
});
