import { resolveCreationProviderId } from './resolveCreationProviderId';
import { resolveActiveProvider } from './resolveActiveProvider';
import { describe, expect, it } from 'vitest';

const SWITCHED = { organisationId: 'switched', organisationName: 'Switched', organisationAbbreviation: 'SW' };
const FROM_JWT = { organisationId: 'from-jwt', organisationName: 'From JWT', organisationAbbreviation: 'JWT' };
const FLAT_CLAIM = 'flat-claim';

describe('resolveActiveProvider', () => {
  it('prefers an explicit provider switch over the JWT provider', () => {
    const loginState: any = { provider: FROM_JWT };

    expect(resolveActiveProvider(loginState, SWITCHED as any)).toBe(SWITCHED);
  });

  it('falls back to the JWT provider when nothing was switched to', () => {
    const loginState: any = { provider: FROM_JWT };

    expect(resolveActiveProvider(loginState, undefined)).toBe(FROM_JWT);
  });

  it('returns undefined when neither source has a provider', () => {
    expect(resolveActiveProvider({ roles: ['superadmin'] } as any, undefined)).toBeUndefined();
    expect(resolveActiveProvider(undefined, undefined)).toBeUndefined();
  });

  // The call sites this replaced used `||`, not `??`. For an object the two are
  // equivalent, and this pins that equivalence so a future `null` provider
  // cannot quietly change which branch wins.
  it('treats a null active provider as absent, matching the || it replaced', () => {
    const loginState: any = { provider: FROM_JWT };

    expect(resolveActiveProvider(loginState, null as any)).toBe(FROM_JWT);
  });
});

// Guard the one thing a reader is most likely to "simplify": these two helpers
// look interchangeable and are not. Creation consults the flat `providerId`
// claim BETWEEN the two rungs, so `resolveActiveProvider(...)?.organisationId`
// is a different answer whenever a token's flat claim disagrees with its
// nested provider.
describe('resolveActiveProvider vs resolveCreationProviderId', () => {
  it('disagree when the flat providerId claim differs from the nested provider', () => {
    const loginState: any = { providerId: FLAT_CLAIM, provider: FROM_JWT };

    expect(resolveActiveProvider(loginState, undefined)?.organisationId).toBe('from-jwt');
    expect(resolveCreationProviderId(loginState, undefined)).toBe(FLAT_CLAIM);
  });

  it('agree once a provider has been explicitly switched to', () => {
    const loginState: any = { providerId: FLAT_CLAIM, provider: FROM_JWT };

    expect(resolveActiveProvider(loginState, SWITCHED as any)?.organisationId).toBe('switched');
    expect(resolveCreationProviderId(loginState, SWITCHED as any)).toBe('switched');
  });
});
