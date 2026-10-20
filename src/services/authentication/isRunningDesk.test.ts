import { describe, expect, it } from 'vitest';

import { isRunningDesk } from './isRunningDesk';

const PROVIDER_TOURNAMENT = { tournamentId: 't-1', parentOrganisation: { organisationId: 'prov-1' } };
const LOCAL_TOURNAMENT = { tournamentId: 't-local' };

describe('isRunningDesk', () => {
  it('false when no tournament is open', () => {
    expect(isRunningDesk({ tournamentRecord: undefined, loginState: null })).toBe(false);
  });

  describe('a provider tournament keeps the #1240 rule: only its provider staff run the desk', () => {
    it('false for an anonymous viewer', () => {
      expect(isRunningDesk({ tournamentRecord: PROVIDER_TOURNAMENT, loginState: null })).toBe(false);
    });

    it('false for an observing super-admin with no association at the provider', () => {
      expect(isRunningDesk({ tournamentRecord: PROVIDER_TOURNAMENT, loginState: { roles: ['superadmin'] } })).toBe(
        false,
      );
    });

    it('false for staff of a different provider', () => {
      const loginState = { providerAssociations: [{ providerId: 'prov-2', providerRole: 'DIRECTOR' }] };
      expect(isRunningDesk({ tournamentRecord: PROVIDER_TOURNAMENT, loginState })).toBe(false);
    });

    it('true for staff of the tournament provider', () => {
      const loginState = { providerAssociations: [{ providerId: 'prov-1', providerRole: 'DIRECTOR' }] };
      expect(isRunningDesk({ tournamentRecord: PROVIDER_TOURNAMENT, loginState })).toBe(true);
    });
  });

  describe('a tournament with no provider', () => {
    it('true for the anonymous scheduling demo: a local record, so this client is its desk', () => {
      expect(isRunningDesk({ tournamentRecord: LOCAL_TOURNAMENT, loginState: null, demoTournament: true })).toBe(true);
    });

    it('false for an ordinary anonymous local record: auto-call stays off outside the demo', () => {
      expect(isRunningDesk({ tournamentRecord: LOCAL_TOURNAMENT, loginState: null })).toBe(false);
      expect(isRunningDesk({ tournamentRecord: LOCAL_TOURNAMENT, loginState: null, demoTournament: false })).toBe(
        false,
      );
    });

    it('an empty organisationId is no provider', () => {
      const tournamentRecord = { parentOrganisation: { organisationId: '' } };
      expect(isRunningDesk({ tournamentRecord, loginState: null, demoTournament: true })).toBe(true);
    });

    it('false for a provider tournament even if flagged as a demo', () => {
      expect(isRunningDesk({ tournamentRecord: PROVIDER_TOURNAMENT, loginState: null, demoTournament: true })).toBe(
        false,
      );
    });

    it('false for a signed-in super-admin: the record may be a legacy server record they only observe (#1240)', () => {
      const loginState = { roles: ['superadmin'] };
      expect(isRunningDesk({ tournamentRecord: LOCAL_TOURNAMENT, loginState, demoTournament: true })).toBe(false);
    });

    it('false for any signed-in user, as before this gate existed', () => {
      const loginState = { providerAssociations: [{ providerId: 'prov-1', providerRole: 'DIRECTOR' }] };
      expect(isRunningDesk({ tournamentRecord: LOCAL_TOURNAMENT, loginState })).toBe(false);
    });
  });
});
