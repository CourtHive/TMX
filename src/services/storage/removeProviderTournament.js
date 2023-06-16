import { context } from 'services/context';
import { tmx2db } from './tmx2db';

export function removeProviderTournament({ providerId, tournamentId }) {
  const refreshCalendar = () => context.router.navigate(`/tournaments/${tournamentId}`);
  const go = (provider) => {
    if (provider) {
      provider.calendar = provider.calendar.filter((item) => item.tournamentId !== tournamentId);
      tmx2db.addProvider(provider).then(refreshCalendar);
    }
  };
  tmx2db.findProvider(providerId).then(go);
}
