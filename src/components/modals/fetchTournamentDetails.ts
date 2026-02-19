/**
 * Fetch tournament details modal by identifier.
 * Validates identifier length and fetches tournament from remote API.
 */
import { fetchTournamentDetails } from 'services/apis/servicesApi';
import { addTournament } from 'services/storage/importTournaments';
import { renderForm } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { openModal } from './baseModal/baseModal';
import { context } from 'services/context';
import { t } from 'i18n';

export function fetchTournamentDetailsModal({ table }: { table: any }): void {
  const tournamentIds = table.getData().map((t: any) => t.tournamentId);
  let inputs: any;

  const enableFetch = ({ inputs }: any) => {
    const identifier = inputs['identifier'].value;
    const isValid = identifier.length > 10;
    const fetchButton = document.getElementById('fetchButton');
    if (fetchButton) (fetchButton as HTMLButtonElement).disabled = !isValid;
  };

  const relationships = [
    {
      control: 'identifier',
      onInput: enableFetch,
    },
  ];

  const content = (elem: HTMLElement) =>
    (inputs = renderForm(
      elem,
      [
        {
          iconLeft: 'fa-solid fa-fingerprint',
          placeholder: 'Identifier',
          label: 'identifier',
          field: 'identifier',
        },
      ],
      relationships,
    ));

  const notFound = () => {
    tmxToast({
      onClose: () => context.router.navigate('/tournaments'),
      message: t('modals.fetchTournament.notFound'),
      intent: 'is-warning',
      pauseOnHover: true,
      action: 'show',
    });
  };

  const showResult = (result: any) => {
    const tournamentRecord = result?.data?.tournamentRecord;
    const tournamentId = result?.data?.tournamentId;
    const exists = tournamentIds.includes(tournamentId);
    if (exists) {
      console.log({ exists });
    } else {
      const callback = () => {};
      addTournament({ tournamentRecord, tournamentIds, table, callback });
    }
  };

  const loadTournament = () => {
    const identifier = inputs.identifier.value;
    fetchTournamentDetails({ identifier }).then(showResult, notFound);
  };

  openModal({
    title: t('modals.fetchTournament.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('modals.fetchTournament.fetch'), id: 'fetchButton', disabled: true, intent: 'is-primary', onClick: loadTournament, close: true },
    ],
  });
}
