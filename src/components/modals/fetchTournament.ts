import { addTournament } from 'services/storage/importTournaments';
import { renderForm } from 'components/renderers/renderForm';
import { getTournament } from 'services/apis/servicesApi';
import { tmxToast } from 'services/notifications/tmxToast';
import { openModal } from './baseModal/baseModal';
import { context } from 'services/context';

export function fetchTournament({ table }) {
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
      action: 'show',
      message: 'Tournament not found',
      onClose: () => context.router.navigate('/tournaments'),
      intent: 'is-warning',
      pauseOnHover: true,
    });
  };

  const showResult = (result) => {
    const tournamentId = inputs.tournamentId.value;
    const tournamentRecord = result.data.tournamentRecords?.[tournamentId];
    // const refresh = () => table?.addData([mapTournamentRecord(tournamentRecord)], true);
    const callback = () => {};
    addTournament({ tournamentRecord, tournamentIds, table, callback });
  };

  const loadTournament = () => {
    const tournamentId = inputs.tournamentId.value;
    getTournament({ tournamentId }).then(showResult, notFound);
  };

  openModal({
    title: 'Login',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Load', intent: 'is-primary', onClick: loadTournament, close: true },
    ],
  });
}
