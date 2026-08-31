import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks must be declared before importing the module under test.
vi.mock('services/authentication/loginState', () => ({ getLoginState: vi.fn() }));

import { getLoginState } from 'services/authentication/loginState';
import { hasGlobalAdminRole } from './hasGlobalAdminRole';

import type { LoginState } from 'types/tmx';

const mockedGetLoginState = vi.mocked(getLoginState);
const BOBOCA = 'boboca-id';

const login = (overrides: Partial<LoginState> = {}): LoginState =>
  ({ email: 'u@x.com', roles: [], permissions: [], services: [], exp: 0, ...overrides }) as LoginState;

beforeEach(() => {
  mockedGetLoginState.mockReset();
});

describe('hasGlobalAdminRole', () => {
  it('is false when not logged in', () => {
    mockedGetLoginState.mockReturnValue(undefined);
    expect(hasGlobalAdminRole()).toBe(false);
  });

  it('is true for superadmin', () => {
    mockedGetLoginState.mockReturnValue(login({ roles: ['superadmin'] }));
    expect(hasGlobalAdminRole()).toBe(true);
  });

  it('is true for the global admin role', () => {
    mockedGetLoginState.mockReturnValue(login({ roles: ['client', 'admin'] }));
    expect(hasGlobalAdminRole()).toBe(true);
  });

  // The whole reason this helper exists rather than reusing isActiveProviderAdmin: the server
  // routes it gates are @Roles([ADMIN, SUPER_ADMIN]), which these three do NOT satisfy. Gating a
  // link on provider-admin would show it to users who can only ever receive a 403.
  it('is false for a PROVIDER_ADMIN', () => {
    mockedGetLoginState.mockReturnValue(
      login({
        roles: ['client'],
        providerAssociations: [
          {
            providerId: BOBOCA,
            providerRole: 'PROVIDER_ADMIN',
            organisationName: 'BOBOCA',
            organisationAbbreviation: 'BOBOCA',
          },
        ],
      }),
    );
    expect(hasGlobalAdminRole()).toBe(false);
  });

  it('is false for a provisioner', () => {
    mockedGetLoginState.mockReturnValue(
      login({
        roles: ['provisioner'],
        provisionerProviders: [{ providerId: BOBOCA, organisationName: 'BOBOCA', organisationAbbreviation: 'BOBOCA' }],
      }),
    );
    expect(hasGlobalAdminRole()).toBe(false);
  });

  it('is false for a plain client', () => {
    mockedGetLoginState.mockReturnValue(login({ roles: ['client'] }));
    expect(hasGlobalAdminRole()).toBe(false);
  });

  it('is false when the JWT carries no roles array at all', () => {
    mockedGetLoginState.mockReturnValue({ email: 'u@x.com' } as LoginState);
    expect(hasGlobalAdminRole()).toBe(false);
  });
});
