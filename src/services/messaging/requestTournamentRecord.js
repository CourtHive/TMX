import { tournamentEngine } from 'tods-competition-factory';
import { connected, emitTmx } from './socketIo';
import { context } from 'services/context';

import { SUCCESS } from 'constants/tmxConstants';

export function requestTournamentRecord() {
  const tournamentId = tournamentEngine.getState()?.tournaentRecord?.tournamentId;

  if (connected()) {
    let data = {
      timestamp: new Date().getTime(),
      tournamentId
    };
    emitTmx({ data: { tournamentRequest: data } });
  } else {
    let message = `Offline: must be connected to internet`;
    context.modal.open({
      title: 'No connection',
      content: message
    });
  }

  return { ...SUCCESS };
}
