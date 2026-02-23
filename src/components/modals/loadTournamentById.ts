import { addTournament } from 'services/storage/importTournaments';
import { requestTournament } from 'services/apis/servicesApi';
import { renderForm } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { openModal } from './baseModal/baseModal';
import { context } from 'services/context';
import { t } from 'i18n';

export function loadTournamentById({ table }) {
  const tournamentIds = table.getData().map((t) => t.tournamentId);
  let inputs;

  const content = (elem) =>
    (inputs = renderForm(elem, [
      {
        iconLeft: 'fa-solid fa-fingerprint',
        placeholder: 'tournamentId',
        label: t('modals.loadTournament.tournamentIdLabel'),
        field: 'tournamentId',
      },
    ]));

  const notFound = () => {
    tmxToast({
      onClose: () => context.router?.navigate('/tournaments'),
      message: t('modals.loadTournament.notFound'),
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
    title: t('modals.loadTournament.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('modals.loadTournament.load'), intent: 'is-primary', onClick: loadTournament, close: true },
    ],
  });
}
