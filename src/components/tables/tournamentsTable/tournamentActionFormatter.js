import { removeProviderTournament } from 'services/storage/removeProviderTournament';
import { removeTournament, requestTournament } from 'services/apis/servicesApi';
import { editTournament } from 'components/drawers/editTournamentDrawer';
import { getLoginState } from 'services/authentication/loginState';
import { openModal } from 'components/modals/baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { tipster } from 'components/popovers/tipster';
import { tmx2db } from 'services/storage/tmx2db';
import { context } from 'services/context';
import { lang } from 'services/translator';

import { BOTTOM } from 'constants/tmxConstants';

export const tournamentActionFormatter = (replaceTableData) => (cell) => {
  const content = document.createElement('span');
  content.style.width = '100%';

  const tournamentId = cell.getValue();

  const deleteTournament = () => {
    const row = cell.getRow();
    const providerId = getLoginState()?.providerId || row.getData().providerId;
    const done = () => {
      row.delete();
      providerId && removeProviderTournament({ tournamentId, providerId });
    };
    const localDelete = () => tmx2db.deleteTournament(tournamentId).then(done, (err) => console.log(err));
    const loginState = getLoginState();
    const provider = loginState?.provider || context?.provider;
    if (provider) {
      removeTournament({ providerId, tournamentId }).then(localDelete, (err) => console.log(err));
    } else {
      localDelete();
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

  const tournamentEdit = () => getTournament({ table: cell.getTable(), tournamentId, replaceTableData });

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
};

export function getTournament({ tournamentId, replaceTableData, table }) {
  const state = getLoginState();
  const provider = state?.provider;

  const notFound = () => {
    tmxToast({
      message: 'Tournament not found',
      onClose: () => {
        context.router.navigate('/tournaments');
      },
      intent: 'is-warning',
      pauseOnHover: true,
    });
  };

  const editRecord = (tournamentRecord) => {
    if (tournamentRecord) {
      editTournament({ table, tournamentRecord, replaceTableData });
    } else {
      notFound();
    }
  };

  const goEdit = (result) => {
    const tournamentRecord = result?.data?.tournamentRecords?.[tournamentId];
    editRecord(tournamentRecord);
  };

  if (provider) {
    requestTournament({ tournamentId }).then(goEdit, (err) => console.log(err));
  } else {
    tmx2db.findTournament(tournamentId).then(editRecord, (err) => console.log(err));
  }
}
