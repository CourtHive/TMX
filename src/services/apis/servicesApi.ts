import { baseApi } from './baseApi';

import type { ProvidersResponse, UsersResponse } from 'types/tmx';

// TODO: URL and parameters should be defined in provider specific location.  Provider-services?
export async function fetchTournamentDetails({ identifier }: { identifier: string }) {
  return await baseApi.post('/service/tournamentdetails', { identifier });
}

export async function requestTournament({ tournamentId }: { tournamentId: string }) {
  return await baseApi.post('/factory/fetch', { tournamentId });
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
  return await baseApi.post('/factory/remove', { providerId, tournamentId });
}
