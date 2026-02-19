import { openModal } from 'components/modals/baseModal/baseModal';
import { tournamentEngine } from 'tods-competition-factory';
import { connected, emitTmx } from './socketIo';
import { t } from 'i18n';

import { SUCCESS } from 'constants/tmxConstants';

export function requestTournamentRecord(): { success: boolean } {
  const tournamentId = tournamentEngine.getTournament()?.tournaentRecord?.tournamentId;

  if (connected()) {
    const data = {
      timestamp: Date.now(),
      tournamentId,
    };
    emitTmx({ data: { tournamentRequest: data }, ackCallback: undefined });
  } else {
    const message = t('toasts.offlineMustConnect');
    openModal({
      title: t('toasts.noConnection'),
      content: message,
      buttons: [],
    });
  }

  return { ...SUCCESS };
}
