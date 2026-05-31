/**
 * Director-side registration endpoints (HiveID Phase 2-B).
 *
 * Mirrors the CFS surface mounted at
 * `/admin/tournaments/:tournamentId/registrations`. baseApi handles the
 * admin JWT (tmxToken); these are admin-audience calls only — the
 * AuthGuard rejects pure HiveID tokens server-side.
 */
import { baseApi } from './baseApi';

export type RegistrationStatus = 'applied' | 'accepted' | 'seeded' | 'withdrawn' | 'waitlisted' | 'rejected';

export interface RegistrationEntry {
  registrationId: string;
  tournamentId: string;
  userId: string;
  personId: string | null;
  eventIds: string[];
  partnerUserId: string | null;
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
  status?: RegistrationStatus;
}): Promise<RegistrationEntry[]> {
  if (!params?.tournamentId) throw new Error('Missing tournamentId');
  const query = params.status ? `?status=${encodeURIComponent(params.status)}` : '';
  const { data } = await baseApi.get(`${adminPath(params.tournamentId)}${query}`);
  return data ?? [];
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

export async function waitlistRegistration(params: {
  tournamentId: string;
  registrationId: string;
  statusReason?: string;
}): Promise<RegistrationEntry> {
  const { data } = await baseApi.post(
    `${adminPath(params.tournamentId)}/${encodeURIComponent(params.registrationId)}/waitlist`,
    { statusReason: params.statusReason },
  );
  return data;
}

export async function rejectRegistration(params: {
  tournamentId: string;
  registrationId: string;
  statusReason?: string;
}): Promise<RegistrationEntry> {
  const { data } = await baseApi.post(
    `${adminPath(params.tournamentId)}/${encodeURIComponent(params.registrationId)}/reject`,
    { statusReason: params.statusReason },
  );
  return data;
}

export async function bulkRegistrationAction(params: {
  tournamentId: string;
  action: 'accept' | 'waitlist' | 'reject';
  registrationIds: string[];
  statusReason?: string;
}): Promise<BulkActionResult> {
  const { data } = await baseApi.post(`${adminPath(params.tournamentId)}/bulk`, {
    action: params.action,
    registrationIds: params.registrationIds,
    statusReason: params.statusReason,
  });
  return data;
}
