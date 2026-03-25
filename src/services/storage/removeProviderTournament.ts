import { tmx2db } from './tmx2db';

export async function removeProviderTournament({
  providerId,
  tournamentId,
}: {
  providerId: string;
  tournamentId: string;
}): Promise<void> {
  const provider = await tmx2db.findProvider(providerId);
  if (!provider) return;

  provider.calendar = provider.calendar.filter((item: any) => item.tournamentId !== tournamentId);
  await tmx2db.addProvider(provider);
}
