import { baseApi } from './baseApi';

import type { ProvidersResponse, UsersResponse } from 'types/tmx';

export async function requestTournament({ tournamentId, silent }: { tournamentId: string; silent?: boolean }) {
  return await baseApi.post('/factory/fetch', { tournamentId }, silent ? { silenceErrors: true } : undefined);
}

/** Lightweight staleness probe — returns only `{ tournamentId, updatedAt }`,
 * never the full tournament record. Used to cheaply detect whether the local
 * copy has fallen behind the server. */
export async function requestTournamentUpdatedAt({ tournamentId, silent }: { tournamentId: string; silent?: boolean }) {
  return await baseApi.post('/factory/updated-at', { tournamentId }, silent ? { silenceErrors: true } : undefined);
}

/** Operational (unpublished) shared-facility schedule projection: slim ScheduleCell[] for the
 * requested tournaments the caller is authorized to view, optionally filtered to venueIds. Used to
 * overlay linked peers' court claims without loading their full records. */
export async function fetchScheduleProjection({
  tournamentId,
  tournamentIds,
  venueIds,
  silent,
}: {
  tournamentId?: string;
  tournamentIds?: string[];
  venueIds?: string[];
  silent?: boolean;
}) {
  return await baseApi.post(
    '/factory/schedule-projection',
    { tournamentId, tournamentIds, venueIds },
    silent ? { silenceErrors: true } : undefined,
  );
}

export async function addProvider({ provider }: { provider: any }) {
  return await baseApi.post('/provider/add', provider);
}

export async function modifyProvider({ provider }: { provider: any }) {
  return await baseApi.post('/provider/modify', provider);
}

export async function getProvider({ providerId }: { providerId: string }) {
  return await baseApi.post('/provider/detail', { providerId });
}

export async function getCalendar({ providerAbbr }: { providerAbbr: string }) {
  return await baseApi.post('/provider/calendar', { providerAbbr });
}

/**
 * Authenticated multi-provider calendar — returns one filtered calendar
 * per provider the user is associated with. Used by TMX when logged in.
 */
export async function getMyCalendars({ providerAbbr }: { providerAbbr?: string } = {}) {
  return await baseApi.post('/provider/my-calendars', { providerAbbr });
}

/**
 * The read-model (courthive-query) origin.
 *
 * A SEPARATE service from CFS, and deliberately so: CFS is the mutation authority, and every
 * person-, team-, provider-scoped read belongs in the warehouse
 * (`Mentat/planning/READ_MODEL_QUERY_SERVICE.md`). In development they are different ports — CFS
 * :8383, query :3150 — so `QUERY_SERVER` must be set. In production nginx routes same-origin
 * `/query/*` to the query service, so the empty default plus the `/query` prefix is correct and
 * nothing needs configuring.
 *
 * Mirrors `courthive-public/src/services/api/programsApi.ts`, which resolves the same origin the
 * same way; keep the two in step.
 */
function queryServiceUrl(path: string): string {
  const configured = process.env.QUERY_SERVER;
  return configured ? `${configured}${path}` : `/query${path}`;
}

/**
 * One TEAM's SCHEDULE — every competition it took part in, whoever owned them, published or not.
 *
 * This is NOT `getCalendar`. A calendar answers "what does this provider own", and a tournament
 * lives in exactly one of them (`detachFromOtherCalendars` enforces it). A college dual belongs to
 * the seasons of TWO programmes, so it is deliberately in neither calendar; the relation it needs
 * is participation.
 *
 * Served by **courthive-query**, not CFS. It was briefly read from CFS's `participation_index`
 * while that was the only implementation; that read model duplicated one courthive-query already
 * answered, for the same id, out of the same database — punch-list **M8**. The operator route is
 * role-gated `ADMIN` / `SUPER_ADMIN` there exactly as it was on CFS, so {@link hasGlobalAdminRole}
 * remains the matching client gate.
 *
 * An absolute (or `/query`-prefixed) URL is passed to `baseApi` on purpose: axios ignores
 * `baseURL` for an absolute URL, so the request still carries the Authorization header, the
 * single-flight 401 refresh and the error toast that every other call gets.
 */
export async function getParticipation({ subjectId }: { subjectId: string }) {
  return await baseApi.get(queryServiceUrl(`/programs/${encodeURIComponent(subjectId)}/participations`));
}

export async function getProviders(): Promise<ProvidersResponse> {
  return await baseApi.post('/provider/allProviders', {});
}

export async function getUsers(): Promise<UsersResponse> {
  return await baseApi.post('/auth/allusers', {});
}

export async function removeUser({ email }: { email: string }) {
  return await baseApi.post('/auth/remove', { email });
}

export async function modifyUser({
  email,
  providerId,
  roles,
  permissions,
  services,
}: {
  email: string;
  providerId?: string;
  roles: string[];
  permissions: string[];
  services: string[];
}) {
  return await baseApi.post('/auth/modify', { email, providerId, roles, permissions, services });
}

export async function sendTournament({ tournamentRecord }: { tournamentRecord: any }) {
  return await baseApi.post('/factory/save', { tournamentRecord });
}

export async function removeTournament({ providerId, tournamentId }: { providerId: string; tournamentId: string }) {
  // silenceErrors: callers inspect response.data.error themselves so they can
  // map errorCode to a localized message and decide whether to run localDelete.
  return await baseApi.post('/factory/remove', { providerId, tournamentId }, { silenceErrors: true });
}
