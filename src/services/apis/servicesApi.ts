import { baseApi } from './baseApi';

export async function requestTournament({ tournamentId }) {
  return await baseApi.post('/factory/fetch', { tournamentId });
}

export async function addProvider({ provider }) {
  return await baseApi.post('/provider/add', { provider });
}

export async function modifyProvider({ provider }) {
  return await baseApi.post('/provider/modify', { provider });
}

export async function getProvider({ providerId }) {
  return await baseApi.post('/provider/detail', { providerId });
}

export async function getCalendar({ providerAbbr }) {
  return await baseApi.post('/provider/calendar', { providerAbbr });
}

export async function getProviders() {
  return await baseApi.post('/provider/allProviders', {});
}

export async function getUsers() {
  return await baseApi.post('/auth/allusers', {});
}

export async function removeUser({ email }) {
  return await baseApi.post('/auth/remove', { email });
}

export async function sendTournament({ tournamentRecord }) {
  return await baseApi.post('/factory/save', { tournamentRecord });
}

export async function removeTournament({ providerId, tournamentId }) {
  return await baseApi.post('/factory/remove', { providerId, tournamentId });
}
