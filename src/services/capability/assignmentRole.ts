/**
 * The caller's assignment role on the loaded tournament, and what it lets them run.
 *
 * The server classifies a tournament assignment (`classifyAssignmentRole` in competition-factory-server's
 * `checkTournamentAccess.ts`): a SCORER may run only `setMatchUpStatus`, an OBSERVER nothing, and anything else is
 * full access. TMX had no copy of that answer, so a scorer was offered every control and refused on save. This module
 * fetches the caller's own assignment for the tournament being opened and mirrors the server's precedence, so a
 * control a scorer cannot run is hidden rather than refused.
 *
 * ## The role governs only when access is assignment-derived
 *
 * As on the server: a SUPER_ADMIN, a provisioner of the tournament's provider, its PROVIDER_ADMIN or the tournament's
 * creator reach it without an assignment, and an unrelated SCORER row must not downgrade them.
 *
 * ## A UX contract, not a security boundary
 *
 * The server stays authoritative. Clearing before the fetch, and resolving on failure, leaves the caller with FULL
 * access here: the worst a missing answer causes is a control offered and then refused, never one wrongly withheld
 * (the direction `loadCallerGrants` takes, for the same reason).
 */
import { getLoginState } from 'services/authentication/loginState';
import { baseApi } from 'services/apis/baseApi';

// constants
import { PROVIDER_ADMIN, SUPER_ADMIN } from 'constants/tmxConstants';

export type AssignmentAccess = 'full' | 'scorer' | 'none';

let assigned: { tournamentId: string; role?: string } | undefined;
let generation = 0;

/** The server's classification of an `assignment_role` value; an unknown value keeps full access, as there. */
export function classifyAssignmentRole(role: string | undefined): AssignmentAccess {
  const normalized = String(role ?? '').toUpperCase();
  if (normalized === 'OBSERVER') return 'none';
  if (normalized === 'SCORER') return 'scorer';
  return 'full';
}

/** What the caller may run on this tournament, given their assignment role, mirroring the server's precedence. */
export function assignmentAccess({
  tournamentRecord,
  loginState,
  role,
}: {
  tournamentRecord?: any;
  loginState?: any;
  role?: string;
}): AssignmentAccess {
  if (!loginState || loginState.roles?.includes(SUPER_ADMIN)) return 'full';
  const providerId = tournamentRecord?.parentOrganisation?.organisationId;
  if (!providerId) return 'full';
  if (loginState.provisionerProviders?.some((p: any) => p.providerId === providerId)) return 'full';
  const association = loginState.providerAssociations?.find((a: any) => a.providerId === providerId);
  if (association?.providerRole === PROVIDER_ADMIN) return 'full';
  const createdBy = tournamentRecord?.extensions?.find((e: any) => e?.name === 'createdByUserId')?.value;
  if (createdBy && createdBy === loginState.userId) return 'full';
  return classifyAssignmentRole(role);
}

export function setAssignmentRole(tournamentId: string | undefined, role?: string): void {
  assigned = tournamentId ? { tournamentId, role } : undefined;
}

export function clearAssignmentRole(): void {
  generation += 1;
  assigned = undefined;
}

/** The caller's assignment role on `tournamentId`, when one was loaded for it. */
export function getAssignmentRole(tournamentId: string | undefined): string | undefined {
  return tournamentId && assigned?.tournamentId === tournamentId ? assigned.role : undefined;
}

/** True when the caller's assignment limits them to scoring single matchUps (or to nothing) on this tournament. */
export function isScoringOnlyAssignment(tournamentRecord: any): boolean {
  const role = getAssignmentRole(tournamentRecord?.tournamentId);
  return assignmentAccess({ tournamentRecord, loginState: getLoginState(), role }) !== 'full';
}

/**
 * Fetch the caller's own assignments and keep the role on `tournamentId`. Resolves rather than rejects: an
 * unreachable server or a deployment without the endpoint leaves no role, which is full access here.
 */
export async function loadAssignmentRole(tournamentId?: string, isCurrent: () => boolean = () => true): Promise<void> {
  clearAssignmentRole();
  const request = generation;
  if (!tournamentId) return;

  try {
    const result: any = await baseApi.post('/factory/assignments/list', {}, { silenceErrors: true } as any);
    const assignments: any[] = Array.isArray(result?.data?.assignments) ? result.data.assignments : [];
    const row = assignments.find((assignment) => assignment?.tournamentId === tournamentId);
    if (request === generation && isCurrent()) setAssignmentRole(tournamentId, row?.assignmentRole);
  } catch {
    // already cleared: full access here, refused by the server if it should be
  }
}
