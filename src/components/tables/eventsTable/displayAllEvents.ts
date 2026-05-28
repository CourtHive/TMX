import { tournamentEngine } from 'services/factory/engine';
import { context } from 'services/context';

import { TOURNAMENT, EVENTS_TAB } from 'constants/tmxConstants';

export function displayAllEvents(): void {
  const tournamentId = tournamentEngine.q.tournament()?.tournamentId;
  if (!tournamentId) return;
  const eventsRoute = `/${TOURNAMENT}/${tournamentId}/${EVENTS_TAB}`;
  context.router?.navigate(eventsRoute);
}
