import { isTournamentProviderMember, type IsTournamentProviderMemberInput } from './isTournamentProviderMember';

/**
 * "Is this client the running desk for the open tournament?" — the gate for desk side effects such as auto-call.
 *
 * A provider's tournament (it carries `parentOrganisation.organisationId`) is run by that provider's staff, so the
 * answer is `isTournamentProviderMember`: an observer, including a super-admin viewing another provider's
 * tournament, must not stamp `calledAt` on it (#1240).
 *
 * The anonymous scheduling demo has no provider and nobody signed in, so it is a local record on this machine and
 * whoever has it open is its desk. That rule is held to demo tournaments (`demoTournament`, which the caller sets
 * from `isDemoClockEligible`): an ordinary anonymous local record (a signed-out club, the example catalog, an
 * imported file) keeps the old answer, false, until auto-call there is a deliberate product change.
 *
 * Signed in, a record with no provider keeps the old answer (`isTournamentProviderMember`, false): it may have come
 * from the server (a legacy record with no `parentOrganisation`), and reopening #1240 for an observing super-admin
 * there is not worth it.
 */
export function isRunningDesk(input: IsTournamentProviderMemberInput & { demoTournament?: boolean }): boolean {
  if (!input.tournamentRecord) return false;
  const anonymousLocal = !input.tournamentRecord.parentOrganisation?.organisationId && !input.loginState;
  if (anonymousLocal && input.demoTournament) return true;
  return isTournamentProviderMember(input);
}
