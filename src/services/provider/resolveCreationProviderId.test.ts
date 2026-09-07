import { resolveCreationProviderId } from './resolveCreationProviderId';
import { describe, expect, it } from 'vitest';

const SELECTED_PROVIDER = 'selected-provider';
const NESTED_PROVIDER = 'nested-provider';
const FLAT_PROVIDER = 'flat-provider';
const JWT_PROVIDER = 'jwt-provider';

describe('resolveCreationProviderId', () => {
  it('uses the explicitly selected provider for a provider-less super-admin', () => {
    const loginState: any = { roles: ['superadmin'] };
    const activeProvider: any = { organisationId: SELECTED_PROVIDER };

    expect(resolveCreationProviderId(loginState, activeProvider)).toBe(SELECTED_PROVIDER);
  });

  it('prefers the explicitly selected provider over the JWT provider', () => {
    const loginState: any = { providerId: JWT_PROVIDER };
    const activeProvider: any = { organisationId: SELECTED_PROVIDER };

    expect(resolveCreationProviderId(loginState, activeProvider)).toBe(SELECTED_PROVIDER);
  });

  it('falls back to either login-state provider representation', () => {
    expect(resolveCreationProviderId({ providerId: FLAT_PROVIDER } as any, undefined)).toBe(FLAT_PROVIDER);
    expect(resolveCreationProviderId({ provider: { organisationId: NESTED_PROVIDER } } as any, undefined)).toBe(
      NESTED_PROVIDER,
    );
  });

  it('prefers the flat providerId claim over the nested provider object', () => {
    const loginState: any = { providerId: FLAT_PROVIDER, provider: { organisationId: NESTED_PROVIDER } };

    expect(resolveCreationProviderId(loginState, undefined)).toBe(FLAT_PROVIDER);
  });

  // The field-omitted case (architectural standards A3: an authorization-shaped
  // check needs a "field absent" case, not only "field present and wrong"). A
  // provider object present but carrying no organisationId must fall through to
  // the JWT rather than resolve to undefined and strand the tournament locally.
  it('falls through an active provider that carries no organisationId', () => {
    const loginState: any = { providerId: JWT_PROVIDER };

    expect(resolveCreationProviderId(loginState, {} as any)).toBe(JWT_PROVIDER);
  });

  it('returns undefined when no provider is active', () => {
    expect(resolveCreationProviderId({ roles: ['superadmin'] } as any, undefined)).toBeUndefined();
    expect(resolveCreationProviderId(undefined, undefined)).toBeUndefined();
  });
});
