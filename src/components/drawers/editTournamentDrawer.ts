/**
 * Tournament editor drawer component.
 * Allows creating new tournaments or editing existing tournament details.
 */
import { addTournament as tournamentAdd } from 'services/storage/importTournaments';
import { mapTournamentRecord } from 'pages/tournaments/mapTournamentRecord';
import { getProvider, sendTournament } from 'services/apis/servicesApi';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { dateValidator } from 'components/validators/dateValidator';
import { nameValidator } from 'components/validators/nameValidator';
import { renderButtons } from 'courthive-components';
import { getLoginState } from 'services/authentication/loginState';
import { renderForm } from 'courthive-components';
import { tournamentEngine } from 'tods-competition-factory';
import { getParent } from 'services/dom/parentAndChild';
import { context } from 'services/context';

import { SET_TOURNAMENT_DATES, SET_TOURNAMENT_NAME } from 'constants/mutationConstants';
import { RIGHT } from 'constants/tmxConstants';

export function editTournament({ table, tournamentRecord }: { table?: any; tournamentRecord?: any }): void {
  const values = {
    activeDates: (tournamentRecord?.activeDates || []).join(','),
    tournamentName: tournamentRecord?.tournamentName || '',
    startDate: tournamentRecord?.startDate || '',
    endDate: tournamentRecord?.endDate || '',
  };

  let inputs: any;
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
    {
      visible: !values.activeDates.length,
      label: 'Select active dates',
      field: 'activeDateSelector',
      id: 'activeDateSelector',
      checkbox: true,
    },
    {
      visible: !!values.activeDates.length,
      value: values.activeDates || [],
      placeholder: '[datesArray]',
      minDate: values.startDate,
      maxDate: values.endDate,
      label: 'Active Dates',
      maxNumberOfDates: 10,
      field: 'activeDates',
      id: 'activeDates',
      date: true,
    },
  ];

  const validValues = ({ tournamentName, startDate, endDate }: any) => {
    return nameValidator(5)(tournamentName) && dateValidator(startDate) && dateValidator(endDate);
  };

  const enableSubmit = ({ inputs }: any) => {
    const activeDates = inputs['activeDates'].value;
    const startDate = inputs['startDate'].value;
    const endDate = inputs['endDate'].value;
    const valid = validValues({
      tournamentName: inputs['tournamentName'].value,
      startDate,
      endDate,
    });

    if (activeDates) {
      inputs['activeDates'].value = activeDates
        .split(',')
        .filter((d: string) =>
          (startDate && new Date(d) < new Date(startDate)) || (endDate && new Date(d) > new Date(endDate))
            ? false
            : true,
        )
        .filter(Boolean)
        .join(',');
    }

    if (startDate) inputs.activeDates.datepicker.setOptions({ minDate: startDate });
    if (endDate) inputs.activeDates.datepicker.setOptions({ maxDate: endDate });

    const saveButton = document.getElementById('saveTournamentEdits');
    if (saveButton) (saveButton as HTMLButtonElement).disabled = !valid;
  };

  const toggleActiveDates = ({ inputs }: any) => {
    const show = inputs.activeDateSelector.checked;
    const activeDates = document.getElementById('activeDates');
    const fieldParent = getParent(activeDates, 'field') as any;
    if (fieldParent?.parent) fieldParent.parent.style.display = show ? 'block' : 'none';
  };

  const relationships = [
    {
      fields: ['startDate', 'endDate'],
      dateRange: true,
    },
    {
      control: 'tournamentName',
      onInput: enableSubmit,
    },
    {
      onFocusOut: enableSubmit,
      control: 'startDate',
    },
    {
      onFocusOut: enableSubmit,
      control: 'endDate',
    },
    {
      onChange: toggleActiveDates,
      control: 'activeDateSelector',
    },
  ];

  const content = (elem: HTMLElement) => {
    inputs = renderForm(elem, items, relationships);
    inputs.activeDates?.datepicker?.update();
  };

  const isValid = () => nameValidator(5)(inputs.drawName.value);
  const submit = () => {
    const activeDates = inputs.activeDates.value?.split(',').filter(Boolean);
    const tournamentName = inputs.tournamentName.value?.trim();
    const startDate = inputs.startDate.value;
    const endDate = inputs.endDate.value;

    if (!tournamentRecord) {
      const result = tournamentEngine.newTournamentRecord({ tournamentName, startDate, endDate });
      if (result.success) {
        const state = getLoginState();
        const newTournamentRecord = tournamentEngine.getTournament()?.tournamentRecord;
        if (state?.providerId) {
          const addProvider = (result: any) => {
            const provider = result.data?.provider;
            newTournamentRecord.parentOrganisation = provider;
            if (provider) {
              const report = (result: any) => console.log('sendTournament', result);
              sendTournament({ tournamentRecord: newTournamentRecord }).then(() => {}, report);
            }
            completeTournamentAdd({ tournamentRecord: newTournamentRecord, table });
          };
          getProvider({ providerId: state.providerId }).then(addProvider);
        } else {
          completeTournamentAdd({ tournamentRecord: newTournamentRecord, table });
        }
      }
    } else {
      const updatedTournamentRecord = { ...tournamentRecord, tournamentName, activeDates, startDate, endDate };
      const postMutation = (result: any) => {
        if (result.success) {
          table?.updateData([mapTournamentRecord(updatedTournamentRecord)], true);
        } else {
          console.log({ result });
        }
      };
      const methods = [
        { method: SET_TOURNAMENT_DATES, params: { activeDates, startDate, endDate } },
        { method: SET_TOURNAMENT_NAME, params: { tournamentName } },
      ];
      mutationRequest({ tournamentRecord: updatedTournamentRecord, methods, callback: postMutation });
    }
  };

  const actionButton = tournamentRecord ? 'Save' : 'Add';
  const buttons = [
    { label: 'Cancel', intent: 'none', close: true },
    {
      disabled: !validValues(values),
      id: 'saveTournamentEdits',
      label: actionButton,
      intent: 'is-primary',
      onClick: submit,
      close: isValid,
    },
  ];

  const footer = (elem: HTMLElement, close: () => void) => renderButtons(elem, buttons, close);
  const title = tournamentRecord ? `Edit tournament` : `New tournament`;
  context.drawer.open({ title, content, footer, side: RIGHT, width: '300px' });
}

function completeTournamentAdd({ tournamentRecord, table }: { tournamentRecord: any; table?: any }): void {
  const refresh = () => table?.addData([mapTournamentRecord(tournamentRecord)], true);
  tournamentAdd({ tournamentRecord, callback: refresh });
}
