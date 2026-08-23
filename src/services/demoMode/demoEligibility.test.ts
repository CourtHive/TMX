import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { featureFlags } from 'config/featureFlags';

vi.mock('services/authentication/tokenManagement', () => ({ getToken: () => mockToken }));

let mockToken: string | undefined;

function tokenWithRoles(roles: string[]): string {
  return `x.${btoa(JSON.stringify({ roles }))}.y`;
}

describe('isDemoEligible', () => {
  beforeEach(() => {
    mockToken = undefined;
    featureFlags.set({ demoMode: true });
  });
  afterEach(() => featureFlags.reset());

  it('is off unless the beta flag is on', async () => {
    const { isDemoEligible } = await import('./demoEligibility');
    featureFlags.set({ demoMode: false });
    expect(isDemoEligible()).toBe(false);
  });

  it('is available to an anonymous session', async () => {
    const { isDemoEligible } = await import('./demoEligibility');
    mockToken = undefined;
    expect(isDemoEligible()).toBe(true);
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
