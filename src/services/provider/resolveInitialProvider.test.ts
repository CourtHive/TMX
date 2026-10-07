import { beforeEach, describe, expect, it, vi } from 'vitest';

let login: any;
vi.mock('services/authentication/loginState', () => ({ getLoginState: () => login }));
vi.mock('services/pdf/pdfFont', () => ({ ensurePdfFontReady: vi.fn() }));
vi.mock('navigation', () => ({ setupChatIndicator: vi.fn() }));

import { resolveInitialProvider } from './providerState';

const associations = [
  { providerId: 'club', providerRole: 'PROVIDER_ADMIN', organisationName: 'Club', organisationAbbreviation: 'CLB' },
  { providerId: 'league', providerRole: 'DIRECTOR', organisationName: 'Alpha League', organisationAbbreviation: 'ALG' },
];

describe('resolveInitialProvider — the provider the session acts for (CA, 2026-10-06)', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
  });

  it("is the session token's provider", () => {
    login = { roles: ['client'], providerId: 'club', providerAssociations: associations };
    expect(resolveInitialProvider()?.organisationId).toBe('club');
  });

  it('is NONE for a session that has not chosen: never the first association alphabetically, never a home', () => {
    login = {
      roles: ['client'],
      providerSelectionRequired: true,
      providerAssociations: associations,
      lastSelectedProviderId: 'league',
    };
    expect(resolveInitialProvider()).toBeUndefined();
  });

  it("is a provisioner's managed provider when the session was issued for it", () => {
    login = {
      roles: ['provisioner'],
      providerId: 'managed',
      providerAssociations: [],
      provisionerProviders: [{ providerId: 'managed', organisationName: 'Managed', organisationAbbreviation: 'MGD' }],
    };
    expect(resolveInitialProvider()?.organisationAbbreviation).toBe('MGD');
  });
});
