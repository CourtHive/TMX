import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renderForm, validators } from 'courthive-components';
import { tournamentEngine } from 'tods-competition-factory';
import { t } from 'i18n';

// constants
import { SET_TOURNAMENT_DATES } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

export function openEditDatesModal({ onSave }: { onSave: () => void }): void {
  const { tournamentInfo } = tournamentEngine.getTournamentInfo();
  const startDate = tournamentInfo?.startDate || '';
  const endDate = tournamentInfo?.endDate || '';

  let inputs: any;

  const enableSubmit = ({ inputs }: any) => {
    const valid =
      validators.dateValidator(inputs['startDate'].value) && validators.dateValidator(inputs['endDate'].value);
    const saveButton = document.getElementById('saveDatesEdits');
    if (saveButton) (saveButton as HTMLButtonElement).disabled = !valid;
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
  ];

  const relationships = [
    { fields: ['startDate', 'endDate'], dateRange: true },
    { control: 'startDate', onFocusOut: enableSubmit },
    { control: 'endDate', onFocusOut: enableSubmit },
  ];

  const content = (elem: HTMLElement) => {
    inputs = renderForm(elem, items, relationships);
  };

  const onClick = () => {
    const newStartDate = inputs['startDate'].value;
    const newEndDate = inputs['endDate'].value;
    const methods = [{ method: SET_TOURNAMENT_DATES, params: { startDate: newStartDate, endDate: newEndDate } }];
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
