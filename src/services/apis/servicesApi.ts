import { baseApi } from './baseApi';

import type { ProvidersResponse, UsersResponse } from 'types/tmx';

// TODO: URL and parameters should be defined in provider specific location.  Provider-services?
export async function fetchTournamentDetails({ identifier }: { identifier: string }) {
  return await baseApi.post('/service/tournamentdetails', { identifier });
}

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
  tournamentIds,
  venueIds,
  silent,
}: {
  tournamentIds: string[];
  venueIds?: string[];
  silent?: boolean;
}) {
  return await baseApi.post('/factory/schedule-projection', { tournamentIds, venueIds }, silent ? { silenceErrors: true } : undefined);
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
