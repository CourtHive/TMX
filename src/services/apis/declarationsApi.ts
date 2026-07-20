/**
 * Director-side reads/decisions against the courthive-declarations service.
 *
 * Pending registrations live OFF CFS (the mutation server). The TD's Registrations
 * tab reads the pending list and rejects/waitlists DIRECTLY here — CFS is only
 * touched on accept (addParticipants). Auth is the same admin JWT (tmxToken); the
 * declarations ProviderAdminGuard verifies it and scopes it to the provider.
 *
 * Base URL: `VITE_DECLARATIONS_URL` (build-time) → localhost-aware fallback
 * (:3120 in dev, `<origin>/declarations` in prod).
 */
import { getJwtTokenStorageKey } from 'config/localStorage';

import type { RegistrationEntry, RegistrationStatus } from './registrationsApi';

// courthive-declarations REGISTRATION statuses → TMX RegistrationEntry statuses.
const STATUS_MAP: Record<string, RegistrationStatus> = {
  SUBMITTED: 'applied',
  ACCEPTED: 'accepted',
  WAITLISTED: 'waitlisted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
};

export interface RegistrationSnapshot {
  declarationId: string;
  personId: string;
  providerId: string;
  tournamentId: string | null;
  status: string;
  payload: {
    eventIds?: string[];
    applicant?: { givenName?: string; familyName?: string };
    answers?: Record<string, unknown>;
  };
  updatedAt: string;
}

export function getDeclarationsBaseUrl(): string {
  const fromVite = (import.meta as any)?.env?.VITE_DECLARATIONS_URL;
  if (fromVite) return String(fromVite).replace(/\/+$/, '');
  const loc = globalThis.location;
  const host = loc?.host ?? '';
  const local = host.includes('localhost') || loc?.hostname === '127.0.0.1';
  return local ? 'http://localhost:3120' : `${loc?.origin ?? ''}/declarations`;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(getJwtTokenStorageKey());
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

// Present a declarations snapshot in the RegistrationEntry shape the tab renders.
// registrationId IS the declarationId; applicant name comes off the denormalized
// payload; there is no CFS userId (registrations are person-keyed).
export function mapSnapshotToEntry(snap: RegistrationSnapshot, tournamentId: string): RegistrationEntry {
  const applicant = snap.payload?.applicant ?? {};
  return {
    registrationId: snap.declarationId,
    tournamentId: snap.tournamentId ?? tournamentId,
    userId: '',
    personId: snap.personId ?? null,
    eventIds: Array.isArray(snap.payload?.eventIds) ? snap.payload.eventIds : [],
    partnerUserId: null,
    answers: snap.payload?.answers ?? {},
    status: STATUS_MAP[snap.status] ?? 'applied',
    statusReason: null,
    appliedAt: snap.updatedAt,
    statusAt: snap.updatedAt,
    decidedByUserId: null,
    participantId: null,
    eventEntries: [],
    createdAt: snap.updatedAt,
    updatedAt: snap.updatedAt,
    applicantGivenName: applicant.givenName ?? null,
    applicantFamilyName: applicant.familyName ?? null,
    applicantEmail: null,
  };
}

export async function fetchTournamentRegistrations(provider: string, tournamentId: string): Promise<RegistrationEntry[]> {
  if (!provider) throw new Error('Missing provider');
  if (!tournamentId) throw new Error('Missing tournamentId');
  const url = `${getDeclarationsBaseUrl()}/registrations?provider=${encodeURIComponent(provider)}&tournamentId=${encodeURIComponent(tournamentId)}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`registrations fetch failed: HTTP ${res.status}`);
  const snaps = await res.json();
  return Array.isArray(snaps) ? snaps.map((s: RegistrationSnapshot) => mapSnapshotToEntry(s, tournamentId)) : [];
}

/** Reject / waitlist a single registration directly (accept goes through CFS). */
export async function decideRegistration(
  provider: string,
  declarationId: string,
  toStatus: 'WAITLISTED' | 'REJECTED',
  reason?: string,
): Promise<RegistrationEntry> {
  const url = `${getDeclarationsBaseUrl()}/registrations/${encodeURIComponent(declarationId)}/decision?provider=${encodeURIComponent(provider)}`;
  const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ toStatus, reason }) });
  if (!res.ok) throw new Error(`registration decision failed: HTTP ${res.status}`);
  const snap = (await res.json()) as RegistrationSnapshot;
  return mapSnapshotToEntry(snap, snap?.tournamentId ?? '');
}
