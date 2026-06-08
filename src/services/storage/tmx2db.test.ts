/**
 * Predicate coverage for selective IndexedDB clearing on auth transitions.
 *
 * The rule comes from Mentat/planning/USER_TOURNAMENT_ACCESS_MODEL.md PR 11:
 * provider-bound tournaments must be wiped on logout / login-as-different-user
 * to prevent user A's cached records surfacing to user B via the local-DB
 * fallback in createTournamentsTable; demo / scratchpad tournaments (no
 * provider) MUST survive the wipe so the demo playground works for logged-out
 * users.
 */
import { describe, expect, it } from 'vitest';

import { isProviderBoundTournament } from './tmx2db';

describe('isProviderBoundTournament', () => {
  it('selects tournaments owned by a provider', () => {
    expect(
      isProviderBoundTournament({
        tournamentId: 'T-1',
        parentOrganisation: { organisationId: 'prov-A' },
      }),
    ).toBe(true);
  });

  it('rejects demo tournaments with no parentOrganisation', () => {
    expect(isProviderBoundTournament({ tournamentId: 'demo-1' })).toBe(false);
  });

  it('rejects tournaments where parentOrganisation lacks an organisationId', () => {
    // Scratchpad records sometimes have a parentOrganisation hint (e.g. a name)
    // without an organisationId. They predate the access model and must be
    // treated as demo data — otherwise they get silently wiped on first login.
    expect(
      isProviderBoundTournament({
        tournamentId: 'T-2',
        parentOrganisation: { organisationName: 'WIP — not yet assigned' },
      }),
    ).toBe(false);
  });

  it('rejects null / undefined defensively', () => {
    expect(isProviderBoundTournament(null)).toBe(false);
    expect(isProviderBoundTournament(undefined)).toBe(false);
  });
});
