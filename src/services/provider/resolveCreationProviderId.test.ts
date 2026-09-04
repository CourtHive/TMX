import { describe, expect, it } from 'vitest';
import { resolveCreationProviderId } from './resolveCreationProviderId';

const SELECTED_PROVIDER = 'selected-provider';

describe('resolveCreationProviderId', () => {
  it('uses the explicitly selected provider for a provider-less super-admin', () => {
    const loginState: any = { roles: ['superadmin'] };
    const activeProvider: any = { organisationId: SELECTED_PROVIDER };

    expect(resolveCreationProviderId(loginState, activeProvider)).toBe(SELECTED_PROVIDER);
  });

  it('prefers the explicitly selected provider over the JWT provider', () => {
    const loginState: any = { providerId: 'jwt-provider' };
    const activeProvider: any = { organisationId: SELECTED_PROVIDER };

    expect(resolveCreationProviderId(loginState, activeProvider)).toBe(SELECTED_PROVIDER);
  });

  it('falls back to either login-state provider representation', () => {
    expect(resolveCreationProviderId({ providerId: 'flat-provider' } as any, undefined)).toBe('flat-provider');
    expect(resolveCreationProviderId({ provider: { organisationId: 'nested-provider' } } as any, undefined)).toBe(
      'nested-provider',
    );
  });

  it('returns undefined when no provider is active', () => {
    expect(resolveCreationProviderId({ roles: ['superadmin'] } as any, undefined)).toBeUndefined();
  });
});
