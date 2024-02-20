import { baseApi } from './baseApi';

export async function requestTournament({ tournamentId }) {
  return await baseApi.post('/factory/fetch', { tournamentId });
}

export async function getCalendar({ providerAbbr }) {
  return await baseApi.post('/provider/calendar', { providerAbbr });
}
