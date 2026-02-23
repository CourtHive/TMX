import { context } from 'services/context';
import { tmx2db } from './tmx2db';

export function removeProviderTournament({ providerId, tournamentId }: { providerId: string; tournamentId: string }): void {
  const refreshCalendar = () => context.router?.navigate(`/tournaments/${tournamentId}`);
  const go = (provider: any) => {
    if (provider) {
      provider.calendar = provider.calendar.filter((item: any) => item.tournamentId !== tournamentId);
      tmx2db.addProvider(provider).then(refreshCalendar);
    }
  };
  tmx2db.findProvider(providerId).then(go);
}
