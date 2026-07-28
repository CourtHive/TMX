/**
 * "Is the current user a member of *this tournament's* provider?"
 *
 * Deliberate inverse of `isActiveProviderAdmin` / `canManageRegistrations`:
 * there is **no super-admin shortcut**. A super-admin merely observing another
 * provider's tournament must NOT be treated as provider staff — this predicate
 * gates side effects that only the running desk should trigger (auto-call being
 * the first: `runAutoCallPass` fires `setMatchUpCalledAt` on load + every
 * ticker, and a viewing super-admin was stamping `calledAt` on tournaments they
 * were only observing).
 *
 * Membership (any one, matched against the tournament's own provider):
 *   1. PROVISIONER managing the tournament's provider (`provisionerProviders`)
 *   2. any provider association at the tournament's provider (`providerAssociations`)
 *
 * Role is intentionally NOT narrowed to PROVIDER_ADMIN — any association with
 * the running provider is desk staff for this purpose. When dedicated "calling"
 * roles land, tighten the association check here.
 *
 * Loose `any` inputs mirror `canManageRegistrations`: both LoginState and
 * Tournament carry many fields we don't need and are read defensively.
 */
export interface IsTournamentProviderMemberInput {
  tournamentRecord?: any;
  loginState?: any;
}

export function isTournamentProviderMember(input: IsTournamentProviderMemberInput): boolean {
  const login = input.loginState;
  if (!login) return false;

  const providerId = input.tournamentRecord?.parentOrganisation?.organisationId;
  if (!providerId) return false;

  // Provisioner-managed provider counts as membership (matches CFS
  // `provisionerProviderIds` in checkTournamentAccess).
  if (login.provisionerProviders?.some((p) => p.providerId === providerId)) return true;

  // Any direct association with the tournament's provider.
  return !!login.providerAssociations?.some((a) => a.providerId === providerId);
}
