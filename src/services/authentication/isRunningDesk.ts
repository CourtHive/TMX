import { isTournamentProviderMember, type IsTournamentProviderMemberInput } from './isTournamentProviderMember';

/**
 * "Is this client the running desk for the open tournament?" — the gate for desk side effects such as auto-call.
 *
 * A provider's tournament (it carries `parentOrganisation.organisationId`) is run by that provider's staff, so the
 * answer is `isTournamentProviderMember`: an observer, including a super-admin viewing another provider's
 * tournament, must not stamp `calledAt` on it (#1240).
 *
 * A tournament with no provider, opened by nobody signed in, can only be a local record on this machine (an
 * anonymous client loads nothing from the server), so whoever has it open is its desk. The anonymous scheduling
 * demo is such a tournament, which is why auto-call runs there with no demo-specific branch.
 *
 * Signed in, a record with no provider keeps the old answer (`isTournamentProviderMember`, false): it may have come
 * from the server (a legacy record with no `parentOrganisation`), and reopening #1240 for an observing super-admin
 * there is not worth it.
 */
export function isRunningDesk(input: IsTournamentProviderMemberInput): boolean {
  if (!input.tournamentRecord) return false;
  if (!input.tournamentRecord.parentOrganisation?.organisationId && !input.loginState) return true;
  return isTournamentProviderMember(input);
}
