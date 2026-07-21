/**
 * Director-side registration endpoints (HiveID Phase 2-B).
 *
 * Pending registrations live OFF CFS: the list + reject/waitlist go DIRECTLY to
 * the declarations service (see declarationsApi), scoped to the tournament's
 * provider on the admin JWT. Only ACCEPT hits CFS — it runs `addParticipants`
 * (the one tournamentRecord mutation) and stamps the decision back in declarations.
 */
import { fetchTournamentRegistrations, decideRegistration } from './declarationsApi';
import { baseApi } from './baseApi';

export type RegistrationStatus = 'applied' | 'accepted' | 'seeded' | 'withdrawn' | 'waitlisted' | 'rejected';

export interface RegistrationEntry {
  registrationId: string;
  tournamentId: string;
  userId: string;
  personId: string | null;
  eventIds: string[];
  partnerUserId: string | null;
  /** Links a doubles registration to its PARTNER_INVITE; both halves of a complete pair share it. */
  partnerInviteId?: string | null;
  answers: Record<string, unknown>;
  status: RegistrationStatus;
  statusReason: string | null;
  appliedAt: string;
  statusAt: string;
  decidedByUserId: string | null;
  participantId: string | null;
  eventEntries: Array<{ eventId: string; entryStatus?: string; entryStage?: string }>;
  createdAt: string;
  updatedAt: string;
  /** Cached canonical name from HiveID; populated by the admin list endpoint. */
  applicantGivenName?: string | null;
  applicantFamilyName?: string | null;
  applicantEmail?: string | null;
}

export interface BulkActionResult {
  results: Array<{ registrationId: string; ok: boolean; error?: string; participantId?: string }>;
}

function adminPath(tournamentId: string): string {
  return `/admin/tournaments/${encodeURIComponent(tournamentId)}/registrations`;
}

export async function getTournamentRegistrations(params: {
  tournamentId: string;
  provider: string;
  status?: RegistrationStatus;
}): Promise<RegistrationEntry[]> {
  if (!params?.tournamentId) throw new Error('Missing tournamentId');
  if (!params?.provider) throw new Error('Missing provider');
  const entries = await fetchTournamentRegistrations(params.provider, params.tournamentId);
  return params.status ? entries.filter((e) => e.status === params.status) : entries;
}

export async function acceptRegistration(params: {
  tournamentId: string;
  registrationId: string;
  statusReason?: string;
}): Promise<{ registration: RegistrationEntry; participantId: string }> {
  const { data } = await baseApi.post(
    `${adminPath(params.tournamentId)}/${encodeURIComponent(params.registrationId)}/accept`,
    { statusReason: params.statusReason },
  );
  return data;
}

export function waitlistRegistration(params: {
  provider: string;
  registrationId: string;
  statusReason?: string;
}): Promise<RegistrationEntry> {
  return decideRegistration(params.provider, params.registrationId, 'WAITLISTED', params.statusReason);
}

export function rejectRegistration(params: {
  provider: string;
  registrationId: string;
  statusReason?: string;
}): Promise<RegistrationEntry> {
  return decideRegistration(params.provider, params.registrationId, 'REJECTED', params.statusReason);
}

/**
 * Bulk accept in a SINGLE CFS mutation. The server accepts all ids in one
 * `executionQueue` (one tournament lock, one save) and folds complete doubles pairs
 * in idempotently — far cheaper than N single accepts. Returns the same per-id result
 * shape (`reason` mapped to `error`) so callers are unchanged.
 */
export async function bulkAcceptRegistrations(params: {
  tournamentId: string;
  registrationIds: string[];
  statusReason?: string;
}): Promise<BulkActionResult> {
  const { data } = await baseApi.post(`${adminPath(params.tournamentId)}/accept-bulk`, {
    registrationIds: params.registrationIds,
    statusReason: params.statusReason,
  });
  const results = (data?.results ?? []).map((r: any) => ({
    registrationId: r.registrationId,
    ok: !!r.ok,
    participantId: r.participantId,
    error: r.reason,
  }));
  return { results };
}

/**
 * Bulk action for the Registrations tab. **Accept** goes to CFS as ONE bulk mutation
 * (`bulkAcceptRegistrations`). **Waitlist/reject** stay a client-side fan-out to the
 * declarations service (no server bulk there — those never touch the tournamentRecord).
 */
export async function bulkRegistrationAction(params: {
  tournamentId: string;
  provider: string;
  action: 'accept' | 'waitlist' | 'reject';
  registrationIds: string[];
  statusReason?: string;
}): Promise<BulkActionResult> {
  if (params.action === 'accept') {
    return bulkAcceptRegistrations({
      tournamentId: params.tournamentId,
      registrationIds: params.registrationIds,
      statusReason: params.statusReason,
    });
  }

  const toStatus = params.action === 'waitlist' ? 'WAITLISTED' : 'REJECTED';
  const results = await Promise.all(
    params.registrationIds.map(async (registrationId) => {
      try {
        await decideRegistration(params.provider, registrationId, toStatus, params.statusReason);
        return { registrationId, ok: true };
      } catch (err: any) {
        return { registrationId, ok: false, error: err?.message ?? String(err) };
      }
    }),
  );
  return { results };
}
