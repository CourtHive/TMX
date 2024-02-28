import { baseApi } from './baseApi';

export async function requestTournament({ tournamentId }) {
  return await baseApi.post('/factory/fetch', { tournamentId });
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

export async function sendTournament({ tournamentRecord }) {
  return await baseApi.post('/factory/save', { tournamentRecord });
}
