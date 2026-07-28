import { describe, expect, it } from 'vitest';

import { isTournamentProviderMember } from './isTournamentProviderMember';

const TOURNAMENT = { parentOrganisation: { organisationId: 'prov-1' } };

describe('isTournamentProviderMember', () => {
  it('false when no login state', () => {
    expect(isTournamentProviderMember({ tournamentRecord: TOURNAMENT, loginState: null })).toBe(false);
  });

  it('false when tournament has no parentOrganisation.organisationId', () => {
    expect(
      isTournamentProviderMember({
        tournamentRecord: {},
        loginState: { providerAssociations: [{ providerId: 'prov-1', providerRole: 'DIRECTOR' }] },
      }),
    ).toBe(false);
  });

  it('false for a super-admin who is NOT associated with the tournament provider', () => {
    // The load-bearing case: an observing super-admin must not auto-call.
    expect(
      isTournamentProviderMember({
        tournamentRecord: TOURNAMENT,
        loginState: { roles: ['superadmin'] },
      }),
    ).toBe(false);
  });

  it('true for any association at the tournament provider (DIRECTOR is desk staff)', () => {
    expect(
      isTournamentProviderMember({
        tournamentRecord: TOURNAMENT,
        loginState: {
          roles: ['client'],
          providerAssociations: [{ providerId: 'prov-1', providerRole: 'DIRECTOR' }],
        },
      }),
    ).toBe(true);
  });

  it('true for PROVIDER_ADMIN at the tournament provider', () => {
    expect(
      isTournamentProviderMember({
        tournamentRecord: TOURNAMENT,
        loginState: {
          roles: ['client'],
          providerAssociations: [{ providerId: 'prov-1', providerRole: 'PROVIDER_ADMIN' }],
        },
      }),
    ).toBe(true);
  });

  it('true for a provisioner managing the tournament provider', () => {
    expect(
      isTournamentProviderMember({
        tournamentRecord: TOURNAMENT,
        loginState: { roles: ['client'], provisionerProviders: [{ providerId: 'prov-1' }] },
      }),
    ).toBe(true);
  });

  it('false when the only association is at a different provider', () => {
    expect(
      isTournamentProviderMember({
        tournamentRecord: TOURNAMENT,
        loginState: {
          roles: ['client'],
          providerAssociations: [{ providerId: 'prov-other', providerRole: 'PROVIDER_ADMIN' }],
        },
      }),
    ).toBe(false);
  });

  it('true when a super-admin also has an association at the tournament provider', () => {
    expect(
      isTournamentProviderMember({
        tournamentRecord: TOURNAMENT,
        loginState: {
          roles: ['superadmin'],
          providerAssociations: [{ providerId: 'prov-1', providerRole: 'DIRECTOR' }],
        },
      }),
    ).toBe(true);
  });
});
