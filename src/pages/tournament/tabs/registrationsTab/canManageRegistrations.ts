/**
 * Pure helper that decides whether the Registrations tab + nav icon
 * should be visible for the currently loaded tournament + caller.
 *
 * Two gates (BOTH must pass):
 *
 *   - Sanctioning step has run. `tournamentRecord.registrationProfile`
 *     must exist with `entriesOpen` set. If a tournament hasn't been
 *     sanctioned (no published registration window) the tab is
 *     meaningless — there's no "Apply" state to manage.
 *
 *   - Caller has provider-admin authority over the tournament's
 *     provider. SUPER_ADMIN, PROVISIONER-managed-provider, or
 *     PROVIDER_ADMIN at `tournament.parentOrganisation.organisationId`.
 *     The server's `canMutateTournament` gate is the security boundary;
 *     this client-side mirror is for UX (don't surface a tab whose
 *     every action will 403).
 *
 * The function takes loose `any` shapes so the caller doesn't have to
 * import the LoginState / Tournament types — both are widely scattered
 * already and the field accesses are stable.
 */
export interface CanManageRegistrationsInput {
  // Loose `any` intentional — both Tournament + LoginState carry many
  // fields we don't need, and the canonical Tournament type allows
  // `registrationProfile.entriesOpen: string | Date` while we only
  // need truthy/falsy. Caller passes records directly from the engine
  // + login store; we read the few fields we care about defensively.
  tournamentRecord?: any;
  loginState?: any;
}

const SUPER_ADMIN = 'superadmin';
const PROVIDER_ADMIN = 'PROVIDER_ADMIN';

export function canManageRegistrations(input: CanManageRegistrationsInput): boolean {
  if (!input.tournamentRecord) return false;
  if (!input.tournamentRecord.registrationProfile?.entriesOpen) return false;

  const login = input.loginState;
  if (!login) return false;

  // SUPER_ADMIN can manage anything.
  if (login.roles?.includes(SUPER_ADMIN)) return true;

  const providerId = input.tournamentRecord.parentOrganisation?.organisationId;
  if (!providerId) return false;

  // Provisioner-managed provider counts as admin-equivalent (matches the
  // CFS `provisionerProviderIds` check in checkTournamentAccess).
  if (login.provisionerProviders?.some((p) => p.providerId === providerId)) return true;

  // Direct provider-admin association.
  return !!login.providerAssociations?.some(
    (a) => a.providerId === providerId && a.providerRole === PROVIDER_ADMIN,
  );
}
