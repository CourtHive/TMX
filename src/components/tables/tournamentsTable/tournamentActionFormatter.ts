import { removeProviderTournament } from 'services/storage/removeProviderTournament';
import { removeTournament, requestTournament } from 'services/apis/servicesApi';
import { editTournament } from 'components/drawers/editTournamentDrawer';
import { getLoginState } from 'services/authentication/loginState';
import { openModal } from 'components/modals/baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { tipster } from 'components/popovers/tipster';
import { tmx2db } from 'services/storage/tmx2db';
import { context } from 'services/context';
import { t } from 'i18n';

import { BOTTOM } from 'constants/tmxConstants';

const handleDeleteCompletion = (row: any, tournamentId: string, providerId: string) => {
  const table = row.getTable();
  row.delete();
  if (providerId) removeProviderTournament({ tournamentId, providerId });
  if (table.getDataCount() === 0) {
    context.router?.navigate(`/tournaments/${Date.now()}`);
  }
};

const performLocalDelete = (tournamentId: string, onComplete: () => void) => {
  return tmx2db.deleteTournament(tournamentId).then(onComplete, (err) => console.log(err));
};

const executeDeleteTournament = (cell: any, tournamentId: string) => {
  const row = cell.getRow();
  const providerId = getLoginState()?.providerId || row.getData().providerId;
  const done = () => handleDeleteCompletion(row, tournamentId, providerId);
  const localDelete = () => performLocalDelete(tournamentId, done);
  const loginState = getLoginState();
  const provider = loginState?.provider || context?.provider;

  if (provider) {
    removeTournament({ providerId, tournamentId }).then(localDelete, (err) => console.log(err));
  } else {
    localDelete();
  }
};

export const tournamentActionFormatter =
  (replaceTableData: () => void) =>
  (cell: any): HTMLSpanElement => {
    const content = document.createElement('span');
    content.style.width = '100%';

    const tournamentId = cell.getValue();

    const deleteTournament = () => executeDeleteTournament(cell, tournamentId);

    const confirmDelete = () => {
      const table = cell.getTable();
      const row = table.getData().find((t: any) => t.tournamentId === tournamentId);
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
      openModal({ title: t('actions.delete_tournament'), buttons, content });
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

export function getTournament({
  tournamentId,
  table,
}: {
  tournamentId: string;
  replaceTableData: () => void;
  table: any;
}): void {
  const state = getLoginState();
  const provider = state?.provider;

  const notFound = () => {
    tmxToast({
      message: 'Tournament not found',
      onClose: () => {
        context.router?.navigate('/tournaments');
      },
      intent: 'is-warning',
      pauseOnHover: true,
    });
  };

  const editRecord = (tournamentRecord: any) => {
    if (tournamentRecord) {
      editTournament({ table, tournamentRecord });
    } else {
      notFound();
    }
  };

  const goEdit = (result: any) => {
    const tournamentRecord = result?.data?.tournamentRecords?.[tournamentId];
    editRecord(tournamentRecord);
  };

  if (provider) {
    requestTournament({ tournamentId }).then(goEdit, (err) => console.log(err));
  } else {
    tmx2db.findTournament(tournamentId).then(editRecord, (err) => console.log(err));
  }
}
