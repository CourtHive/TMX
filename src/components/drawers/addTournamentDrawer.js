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
  const items = [
    {
      error: 'minimum of 5 characters',
      placeholder: 'Tournament name',
      validator: nameValidator(5),
      label: 'Tournament name',
      field: 'tournamentName',
      focus: true
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
  ];

  const relationships = [
    {
      fields: ['startDate', 'endDate'],
      dateRange: true
    }
  ];

  const content = (elem) => {
    inputs = renderForm(elem, items, relationships);
  };

  const isValid = () => nameValidator(5)(inputs.drawName.value);
  const submit = () => {
    const tournamentName = inputs.tournamentName.value;
    const startDate = inputs.startDate.value;
    const endDate = inputs.endDate.value;

    const result = tournamentEngine.newTournamentRecord({ tournamentName, startDate, endDate });
    if (result.success) {
      const { tournamentRecord } = tournamentEngine.getTournament();
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
  context.drawer.open({ title, content, footer, side: RIGHT, width: '300px' });
}
