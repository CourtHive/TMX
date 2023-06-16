import { addTournament as tournamentAdd } from 'services/storage/importTournaments';
import { mapTournamentRecord } from 'Pages/Tournaments/mapTournamentRecord';
import { nameValidator } from 'components/validators/nameValidator';
import { renderButtons } from 'components/renderers/renderButtons';
import { renderForm } from 'components/renderers/renderForm';
import { tournamentEngine } from 'tods-competition-factory';
import { context } from 'services/context';

import { RIGHT } from 'constants/tmxConstants';

export function addTournament({ table }) {
  let inputs;
  const content = (elem) => {
    inputs = renderForm(elem, [
      {
        placeholder: 'Tournament name',
        label: 'Tournament name',
        field: 'tournamentName',
        error: 'Please enter a name of at least 5 characters',
        validator: nameValidator(5)
      },
      {
        placeholder: 'YYYY-MM-DD',
        label: 'Start date',
        field: 'startDate'
      },
      {
        placeholder: 'YYYY-MM-DD',
        label: 'End date',
        field: 'endDate'
      }
    ]);
  };

  const isValid = () => nameValidator(5)(inputs.drawName.value);
  const submit = () => {
    const tournamentName = inputs.tournamentName.value;
    const startDate = inputs.startDate.value;
    const endDate = inputs.startDate.value;

    const result = tournamentEngine.newTournamentRecord({ tournamentName, startDate, endDate });
    if (result.success) {
      const { tournamentRecord } = tournamentEngine.getState();
      const refresh = () => table?.addData([mapTournamentRecord(tournamentRecord)], true);
      tournamentAdd({ tournamentRecord, callback: refresh });
    }
  };
  const buttons = [
    { label: 'Cancel', intent: 'none', close: true },
    { label: 'Add', intent: 'is-primary', onClick: submit, close: isValid }
  ];
  const title = `New tournament`;

  const footer = (elem, close) => renderButtons(elem, buttons, close);
  context.drawer.open({ title, content, footer, context: 'tournament', side: RIGHT, width: 400 });
}
