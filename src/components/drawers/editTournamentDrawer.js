import { addTournament as tournamentAdd } from 'services/storage/importTournaments';
import { mapTournamentRecord } from 'pages/tournaments/mapTournamentRecord';
import { getProvider, sendTournament } from 'services/apis/servicesApi';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { nameValidator } from 'components/validators/nameValidator';
import { renderButtons } from 'components/renderers/renderButtons';
import { getLoginState } from 'services/authentication/loginState';
import { renderForm } from 'components/renderers/renderForm';
import { tournamentEngine } from 'tods-competition-factory';
import { context } from 'services/context';

import { RIGHT } from 'constants/tmxConstants';

export function editTournament({ table, tournamentRecord }) {
  const values = {
    tournamentName: tournamentRecord?.tournamentName || '',
    startDate: tournamentRecord?.startDate || '',
    endDate: tournamentRecord?.endDate || '',
  };

  let inputs;
  const items = [
    {
      error: 'minimum of 5 characters',
      placeholder: 'Tournament name',
      value: values.tournamentName,
      validator: nameValidator(5),
      label: 'Tournament name',
      field: 'tournamentName',
      focus: true,
    },
    {
      placeholder: 'YYYY-MM-DD',
      value: values.startDate,
      label: 'Start date',
      field: 'startDate',
    },
    {
      placeholder: 'YYYY-MM-DD',
      value: values.endDate,
      label: 'End date',
      field: 'endDate',
    },
  ];

  const relationships = [
    {
      fields: ['startDate', 'endDate'],
      dateRange: true,
    },
  ];

  const content = (elem) => {
    inputs = renderForm(elem, items, relationships);
  };

  const isValid = () => nameValidator(5)(inputs.drawName.value);
  const submit = () => {
    const tournamentName = inputs.tournamentName.value;
    const startDate = inputs.startDate.value;
    const endDate = inputs.endDate.value;

    if (!tournamentRecord) {
      const result = tournamentEngine.newTournamentRecord({ tournamentName, startDate, endDate });
      if (result.success) {
        const state = getLoginState();
        const newTournamentRecord = tournamentEngine.getTournament()?.tournamentRecord;
        if (state?.providerId) {
          const addProvider = (result) => {
            const provider = result.data?.provider;
            newTournamentRecord.parentOrganisation = provider;
            if (provider) {
              const report = (result) => console.log('sendTournament', result);
              sendTournament({ tournamentRecord: newTournamentRecord }).then(report, report);
            }
            completeTournamentAdd({ tournamentRecord: newTournamentRecord, table });
          };
          getProvider({ providerId: state.providerId }).then(addProvider);
        } else {
          completeTournamentAdd({ tournamentRecord: newTournamentRecord, table });
        }
      }
    } else {
      const updatedTournamentRecord = { ...tournamentRecord, tournamentName, startDate, endDate };
      const postMutation = (result) => {
        console.log({ result });
        if (result.success) {
          table?.updateData([mapTournamentRecord(updatedTournamentRecord)]);
          // only add if not a provider or saveLocal
          tournamentAdd({ tournamentRecord: updatedTournamentRecord });
        } else {
          console.log({ result });
        }
      };
      const methods = [
        { method: 'setTournamentName', params: { tournamentName } },
        { method: 'setTournamentDates', params: { startDate, endDate } },
      ];
      mutationRequest({ tournamentRecord: updatedTournamentRecord, methods, callback: postMutation });
    }
  };
  const buttons = [
    { label: 'Cancel', intent: 'none', close: true },
    { label: 'Add', intent: 'is-primary', onClick: submit, close: isValid },
  ];
  const title = `New tournament`;

  const footer = (elem, close) => renderButtons(elem, buttons, close);
  context.drawer.open({ title, content, footer, side: RIGHT, width: '300px' });
}

function completeTournamentAdd({ tournamentRecord, table }) {
  const refresh = () => table?.addData([mapTournamentRecord(tournamentRecord)], true);
  tournamentAdd({ tournamentRecord, callback: refresh });
}
