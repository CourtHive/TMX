import { removeProviderTournament } from 'services/storage/removeProviderTournament';
import { getLoginState } from 'services/authentication/loginState';
import { openModal } from 'components/modals/baseModal/baseModal';
import { emitTmx } from 'services/messaging/socketIo';
import { tipster } from 'components/popovers/tipster';
import { tmx2db } from 'services/storage/tmx2db';
import { lang } from 'services/translator';

import { BOTTOM } from 'constants/tmxConstants';

export function actionFormatter(cell) {
  const content = document.createElement('span');
  content.style.width = '100%';

  const tournamentId = cell.getValue();

  const deleteTournament = () => {
    let deleteTournament = { tournamentId };
    emitTmx({ data: { deleteTournament } });

    tmx2db.deleteTournament(tournamentId).then(done, (err) => console.log(err));
    function done() {
      const row = cell.getRow();
      row.delete();
      const providerId = getLoginState()?.providerId;
      providerId && removeProviderTournament({ tournamentId, providerId });
    }
  };

  const confirmDelete = () => {
    const table = cell.getTable();
    const row = table.getData().find((t) => t.tournamentId === tournamentId);
    const content = `<div style='font-size: 2em'>${row.tournament.tournamentName} will be deleted!</div>`;
    const buttons = [
      {
        onClick: deleteTournament,
        intent: 'is-danger',
        label: 'Delete',
        close: true,
      },
      { label: 'Cancel' },
    ];
    openModal({ title: lang.tr('actions.delete_tournament'), buttons, content });
  };

  const tournamentEdit = () => {
    console.log('tournament Edit');
    const goEdit = (tournamentRecord) => {
      console.log('edit:', { tournamentRecord });
    };
    tmx2db.findTournament(tournamentId).then(goEdit, (err) => console.log(err));
  };

  const button = document.createElement('span');
  button.innerHTML = "<i class='fa fa-ellipsis-vertical'></i>";

  content.onclick = (e) => {
    e.stopPropagation();
    tipster({
      target: button,
      items: [
        { text: 'Delete', onClick: confirmDelete },
        { text: 'Edit', onClick: tournamentEdit },
      ],
      config: { placement: BOTTOM },
    });
  };
  content.appendChild(button);

  return content;
}
