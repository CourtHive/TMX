import { describe, expect, it } from 'vitest';

import { canManageRegistrations } from './canManageRegistrations';

const PUBLISHED_TOURNAMENT = {
  parentOrganisation: { organisationId: 'prov-1' },
  registrationProfile: { entriesOpen: '2026-06-01T00:00:00Z' },
};

describe('canManageRegistrations', () => {
  it('false when no tournament is loaded', () => {
    expect(
      canManageRegistrations({
        tournamentRecord: null,
        loginState: { roles: ['superadmin'] },
      }),
    ).toBe(false);
  });

  it('false when tournament has no registrationProfile (sanctioning not run)', () => {
    expect(
      canManageRegistrations({
        tournamentRecord: { parentOrganisation: { organisationId: 'prov-1' } },
        loginState: { roles: ['superadmin'] },
      }),
    ).toBe(false);
  });

  it('false when registrationProfile has no entriesOpen', () => {
    expect(
      canManageRegistrations({
        tournamentRecord: {
          parentOrganisation: { organisationId: 'prov-1' },
          registrationProfile: { entriesOpen: null },
        },
        loginState: { roles: ['superadmin'] },
      }),
    ).toBe(false);
  });

  it('false when no login state', () => {
    expect(
      canManageRegistrations({
        tournamentRecord: PUBLISHED_TOURNAMENT,
        loginState: null,
      }),
    ).toBe(false);
  });

  it('true for SUPER_ADMIN regardless of provider', () => {
    expect(
      canManageRegistrations({
        tournamentRecord: PUBLISHED_TOURNAMENT,
        loginState: { roles: ['superadmin'] },
      }),
    ).toBe(true);
  });

  it('true when caller has PROVIDER_ADMIN at the tournament provider', () => {
    expect(
      canManageRegistrations({
        tournamentRecord: PUBLISHED_TOURNAMENT,
        loginState: {
          roles: ['client'],
          providerAssociations: [
            { providerId: 'prov-1', providerRole: 'PROVIDER_ADMIN' },
            { providerId: 'prov-2', providerRole: 'DIRECTOR' },
          ],
        },
      }),
    ).toBe(true);
  });

  it('false when caller has only DIRECTOR (sub-admin) at the provider', () => {
    expect(
      canManageRegistrations({
        tournamentRecord: PUBLISHED_TOURNAMENT,
        loginState: {
          roles: ['client'],
          providerAssociations: [{ providerId: 'prov-1', providerRole: 'DIRECTOR' }],
        },
      }),
    ).toBe(false);
  });

  it('true when caller is a provisioner managing the tournament provider', () => {
    expect(
      canManageRegistrations({
        tournamentRecord: PUBLISHED_TOURNAMENT,
        loginState: {
          roles: ['client'],
          provisionerProviders: [{ providerId: 'prov-1' }],
        },
      }),
    ).toBe(true);
  });

  it('false when association is at a different provider', () => {
    expect(
      canManageRegistrations({
        tournamentRecord: PUBLISHED_TOURNAMENT,
        loginState: {
          roles: ['client'],
          providerAssociations: [{ providerId: 'prov-other', providerRole: 'PROVIDER_ADMIN' }],
        },
      }),
    ).toBe(false);
  });

  it('false when tournament has no parentOrganisation.organisationId', () => {
    expect(
      canManageRegistrations({
        tournamentRecord: {
          registrationProfile: { entriesOpen: '2026-06-01T00:00:00Z' },
          // no parentOrganisation
        },
        loginState: {
          roles: ['client'],
          providerAssociations: [{ providerId: 'prov-1', providerRole: 'PROVIDER_ADMIN' }],
        },
      }),
    ).toBe(false);
  });
});
