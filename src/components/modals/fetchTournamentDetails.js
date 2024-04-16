import { fetchTournamentDetails } from 'services/apis/servicesApi';
import { addTournament } from 'services/storage/importTournaments';
import { renderForm } from 'components/renderers/renderForm';
import { tmxToast } from 'services/notifications/tmxToast';
import { openModal } from './baseModal/baseModal';
import { context } from 'services/context';

export function fetchTournamentDetailsModal({ table }) {
  const tournamentIds = table.getData().map((t) => t.tournamentId);
  let inputs;

  const enableFetch = ({ inputs }) => {
    const identifier = inputs['identifier'].value;
    const isValid = identifier.length > 10;
    const fetchButton = document.getElementById('fetchButton');
    if (fetchButton) fetchButton.disabled = !isValid;
  };

  const relationships = [
    {
      control: 'identifier',
      onInput: enableFetch,
    },
  ];

  const content = (elem) =>
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
      message: 'Tournament not found',
      intent: 'is-warning',
      pauseOnHover: true,
      action: 'show',
    });
  };

  const showResult = (result) => {
    const tournamentRecord = result?.data?.tournamentRecord;
    const tournamentId = result?.data?.tournamentId;
    const exists = tournamentIds.includes(tournamentId);
    if (!exists) {
      const callback = () => {};
      addTournament({ tournamentRecord, tournamentIds, table, callback });
    } else {
      console.log({ exists });
      // TODO: check for updated participants and tournamentInfo
    }
  };

  const loadTournament = () => {
    const identifier = inputs.identifier.value;
    fetchTournamentDetails({ identifier }).then(showResult, notFound);
  };

  openModal({
    title: 'Fetch tournament details',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Fetch', id: 'fetchButton', disabled: true, intent: 'is-primary', onClick: loadTournament, close: true },
    ],
  });
}
