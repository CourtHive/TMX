import { tournamentEngine } from 'tods-competition-factory';
import { context } from 'services/context';

import { TOURNAMENT, EVENTS_TAB } from 'constants/tmxConstants';

export function displayAllEvents() {
  const tournamentId = tournamentEngine.getState().tournamentRecord.tournamentId;
  const eventsRoute = `/${TOURNAMENT}/${tournamentId}/${EVENTS_TAB}`;
  context.router.navigate(eventsRoute);
}
