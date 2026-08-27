import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { featureFlags } from 'config/featureFlags';
import { context } from 'services/context';

vi.mock('services/authentication/tokenManagement', () => ({ getToken: () => mockToken }));

let mockToken: string | undefined;

function tokenWithRoles(roles: string[]): string {
  return `x.${btoa(JSON.stringify({ roles }))}.y`;
}

describe('isDemoEligible', () => {
  beforeEach(() => {
    mockToken = undefined;
    context.provider = undefined;
    featureFlags.set({ demoMode: true });
  });
  afterEach(() => {
    featureFlags.reset();
    context.provider = undefined;
  });

  // The flag is the opt-in for a *provider-bearing* session. A session with no
  // provider is the demo, so it does not wait for a flag nothing can set.
  it('is available to an anonymous session even with the beta flag off', async () => {
    const { isDemoEligible } = await import('./demoEligibility');
    featureFlags.set({ demoMode: false });
    expect(isDemoEligible()).toBe(true);
  });

  it('is available to an anonymous session', async () => {
    const { isDemoEligible } = await import('./demoEligibility');
    mockToken = undefined;
    expect(isDemoEligible()).toBe(true);
  });

  // An impersonation handoff can seat a provider without a token; that session
  // carries a white label the overlay would contradict.
  it('is NOT available to a tokenless session carrying an impersonated provider', async () => {
    const { isDemoEligible } = await import('./demoEligibility');
    context.provider = { organisationId: 'p1', organisationName: 'P', organisationAbbreviation: 'P' };
    expect(isDemoEligible()).toBe(false);
  });

  it('requires the beta flag for a super-admin', async () => {
    const { isDemoEligible } = await import('./demoEligibility');
    featureFlags.set({ demoMode: false });
    mockToken = tokenWithRoles(['superadmin', 'client']);
    expect(isDemoEligible()).toBe(false);
  });

  it('is available to a super-admin', async () => {
    const { isDemoEligible } = await import('./demoEligibility');
    mockToken = tokenWithRoles(['superadmin', 'client']);
    expect(isDemoEligible()).toBe(true);
  });

  // Deliberate: one stray click by a provider member on a live provider becomes
  // a support ticket saying TMX is broken.
  it('is NOT available to an ordinary logged-in user', async () => {
    const { isDemoEligible } = await import('./demoEligibility');
    mockToken = tokenWithRoles(['client']);
    expect(isDemoEligible()).toBe(false);
  });

  it('fails closed on an unparseable token', async () => {
    const { isDemoEligible } = await import('./demoEligibility');
    mockToken = 'not-a-jwt';
    expect(isDemoEligible()).toBe(false);
  });
});
