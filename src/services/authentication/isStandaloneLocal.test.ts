import { describe, expect, it, vi, beforeEach } from 'vitest';
import { isStandaloneLocal } from './isStandaloneLocal';

const loginState = vi.hoisted(() => ({ value: undefined as any }));
vi.mock('services/authentication/loginState', () => ({ getLoginState: () => loginState.value }));

const LOCAL = { tournamentId: 'local' };
const PROVIDER_BOUND = { tournamentId: 'bound', parentOrganisation: { organisationId: 'provider' } };

describe('isStandaloneLocal', () => {
  beforeEach(() => {
    loginState.value = undefined;
  });

  it('is true when logged out and no record names a parent organisation', () => {
    expect(isStandaloneLocal([LOCAL])).toBe(true);
  });

  it('is false for a provider-bound record, even logged out', () => {
    expect(isStandaloneLocal([PROVIDER_BOUND])).toBe(false);
    expect(isStandaloneLocal([LOCAL, PROVIDER_BOUND])).toBe(false);
  });

  it('is false whenever someone is logged in', () => {
    loginState.value = { roles: [] };
    expect(isStandaloneLocal([LOCAL])).toBe(false);
  });

  it('is false with no records to judge', () => {
    expect(isStandaloneLocal([])).toBe(false);
  });
});
