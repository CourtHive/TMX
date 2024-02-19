import { baseApi } from './baseApi';

export async function getIdioms() {
  const result = await baseApi.post('/api/idioms');
  console.log({ result });
}

export async function getTournament({ tournamentId }) {
  return await baseApi.post('/factory/fetch', { tournamentId });
}
