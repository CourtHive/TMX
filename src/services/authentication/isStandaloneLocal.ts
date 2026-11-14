import { getLoginState } from 'services/authentication/loginState';

/**
 * A tournament nobody governs: no one is logged in and no record names a parent organisation (a provider). There is
 * no provider to opt in to anything and no server to refuse, so a provider opt-in such as `canMergeParticipants`
 * does not apply to it. The demo overlay still narrows it, so demo mode can switch the action off.
 */
export function isStandaloneLocal(tournamentRecords: any[]): boolean {
  if (getLoginState()) return false;
  return (
    tournamentRecords.length > 0 && tournamentRecords.every((record) => !record?.parentOrganisation?.organisationId)
  );
}
