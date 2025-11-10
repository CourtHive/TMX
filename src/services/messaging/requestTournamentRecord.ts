import { openModal } from 'components/modals/baseModal/baseModal';
import { tournamentEngine } from 'tods-competition-factory';
import { connected, emitTmx } from './socketIo';

import { SUCCESS } from 'constants/tmxConstants';

export function requestTournamentRecord(): { success: boolean } {
  const tournamentId = tournamentEngine.getTournament()?.tournaentRecord?.tournamentId;

  if (connected()) {
    const data = {
      timestamp: new Date().getTime(),
      tournamentId
    };
    emitTmx({ data: { tournamentRequest: data }, ackCallback: undefined });
  } else {
    const message = `Offline: must be connected to internet`;
    openModal({
      title: 'No connection',
      content: message,
      buttons: []
    });
  }

  return { ...SUCCESS };
}
