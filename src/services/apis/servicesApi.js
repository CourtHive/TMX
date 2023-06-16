import { baseApi } from './baseApi';

export async function getIdioms() {
  const result = await baseApi.post('/api/idioms');
  console.log({ result });
}

export async function getTournament({ providerId, tournamentId }) {
  if (!providerId) return { error: 'missing providerId' };
  return await baseApi.post('/api/tournament', { providerId, tournamentId });
}
