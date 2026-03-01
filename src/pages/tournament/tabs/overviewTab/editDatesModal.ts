import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm, validators } from 'courthive-components';
import { tournamentEngine } from 'tods-competition-factory';
import { getParent } from 'services/dom/parentAndChild';
import { t } from 'i18n';

// constants
import { SET_TOURNAMENT_DATES } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

export function openEditDatesModal({ onSave }: { onSave: () => void }): void {
  const { tournamentInfo } = tournamentEngine.getTournamentInfo();
  const startDate = tournamentInfo?.startDate || '';
  const endDate = tournamentInfo?.endDate || '';
  const existingActiveDates = (tournamentInfo?.activeDates || []).join(',');

  let inputs: any;

  const enableSubmit = ({ inputs }: any) => {
    const newStartDate = inputs['startDate'].value;
    const newEndDate = inputs['endDate'].value;
    const valid = validators.dateValidator(newStartDate) && validators.dateValidator(newEndDate);

    // Filter activeDates to stay within the date range
    const activeDates = inputs['activeDates'].value;
    if (activeDates) {
      inputs['activeDates'].value = activeDates
        .split(',')
        .filter(
          (d: string) =>
            !((newStartDate && new Date(d) < new Date(newStartDate)) ||
              (newEndDate && new Date(d) > new Date(newEndDate))),
        )
        .filter(Boolean)
        .join(',');
    }

    if (newStartDate) inputs.activeDates.datepicker?.setOptions({ minDate: newStartDate });
    if (newEndDate) inputs.activeDates.datepicker?.setOptions({ maxDate: newEndDate });

    const saveButton = document.getElementById('saveDatesEdits');
    if (saveButton) (saveButton as HTMLButtonElement).disabled = !valid;
  };

  const toggleActiveDates = ({ inputs }: any) => {
    const show = inputs.activeDateSelector.checked;
    const activeDates = document.getElementById('activeDates');
    const fieldParent = getParent(activeDates, 'field') as any;
    if (fieldParent?.parent) fieldParent.parent.style.display = show ? 'block' : 'none';
  };

  const items = [
    {
      placeholder: 'YYYY-MM-DD',
      value: startDate,
      label: t('modals.editDates.startDateLabel'),
      field: 'startDate',
    },
    {
      placeholder: 'YYYY-MM-DD',
      value: endDate,
      label: t('modals.editDates.endDateLabel'),
      field: 'endDate',
    },
    {
      visible: !existingActiveDates.length,
      label: t('drawers.editTournament.selectActiveDates'),
      field: 'activeDateSelector',
      id: 'activeDateSelector',
      checkbox: true,
    },
    {
      visible: !!existingActiveDates.length,
      value: existingActiveDates || [],
      placeholder: '[datesArray]',
      minDate: startDate,
      maxDate: endDate,
      label: t('drawers.editTournament.activeDates'),
      maxNumberOfDates: 10,
      field: 'activeDates',
      id: 'activeDates',
      date: true,
    },
  ];

  const relationships = [
    { fields: ['startDate', 'endDate'], dateRange: true },
    { control: 'startDate', onFocusOut: enableSubmit },
    { control: 'endDate', onFocusOut: enableSubmit },
    { control: 'activeDateSelector', onChange: toggleActiveDates },
  ];

  const content = (elem: HTMLElement) => {
    inputs = renderForm(elem, items, relationships);
    inputs.activeDates?.datepicker?.update();
  };

  const onClick = () => {
    const newStartDate = inputs['startDate'].value;
    const newEndDate = inputs['endDate'].value;
    const activeDates = inputs['activeDates'].value?.split(',').filter(Boolean);
    const methods = [
      { method: SET_TOURNAMENT_DATES, params: { startDate: newStartDate, endDate: newEndDate, activeDates } },
    ];
    const postMutation = (result: any) => {
      if (result?.success) {
        closeModal();
        onSave();
      }
    };
    mutationRequest({ methods, callback: postMutation });
  };

  const valid = validators.dateValidator(startDate) && validators.dateValidator(endDate);

  openModal({
    title: t('modals.editDates.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      { label: t('common.save'), id: 'saveDatesEdits', disabled: !valid, intent: 'is-primary', onClick },
    ],
  });
}
