import { addTournament } from 'services/storage/importTournaments';
import { requestTournament } from 'services/apis/servicesApi';
import { renderForm } from 'components/renderers/renderForm';
import { tmxToast } from 'services/notifications/tmxToast';
import { openModal } from './baseModal/baseModal';
import { context } from 'services/context';

export function loadTournamentById({ table }) {
  const tournamentIds = table.getData().map((t) => t.tournamentId);
  let inputs;

  const content = (elem) =>
    (inputs = renderForm(elem, [
      {
        iconLeft: 'fa-solid fa-fingerprint',
        placeholder: 'tournamentId',
        label: 'Tournament Id',
        field: 'tournamentId',
      },
    ]));

  const notFound = () => {
    tmxToast({
      onClose: () => context.router.navigate('/tournaments'),
      message: 'Tournament not found',
      intent: 'is-warning',
      pauseOnHover: true,
      action: 'show',
    });
  };

  const showResult = (result) => {
    const tournamentId = inputs.tournamentId.value;
    const tournamentRecord = result.data.tournamentRecords?.[tournamentId];
    const callback = () => {};
    addTournament({ tournamentRecord, tournamentIds, table, callback });
  };

  const loadTournament = () => {
    const tournamentId = inputs.tournamentId.value;
    requestTournament({ tournamentId }).then(showResult, notFound);
  };

  openModal({
    title: 'Load tournament',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Load', intent: 'is-primary', onClick: loadTournament, close: true },
    ],
  });
}
