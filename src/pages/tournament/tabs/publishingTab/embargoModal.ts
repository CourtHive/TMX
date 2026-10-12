/**
 * Embargo date/time picker modal.
 * Uses renderForm for inputs, vanillajs-datepicker for the date field,
 * and attachTimePicker for time — consistent with patterns used elsewhere in TMX.
 * Local date/time is converted to GMT for storage.
 */
import { attachTimePicker } from 'pages/tournament/tabs/venuesTab/venueTimeHelpers';
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { embargoToLocalParts, venuePartsToGMT } from './embargoTime';
import { renderForm, validators } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { toDisplayTime } from 'components/forms/venue';
import { Datepicker } from 'vanillajs-datepicker';
import { t, i18next } from 'i18n';

import { NONE } from 'constants/tmxConstants';

type EmbargoModalParams = {
  title?: string;
  currentEmbargo?: string;
  onSet: (isoString: string) => void;
  onClear?: () => void;
};

export function openEmbargoModal({ title, currentEmbargo, onSet, onClear }: EmbargoModalParams): void {
  const { date, time } = embargoToLocalParts(currentEmbargo);

  let inputs: any;
  let modalHandle: any;

  const enableSubmit = () => {
    const dateValid = validators.dateValidator(inputs?.embargoDate?.value);
    const timeValid = !!inputs?.embargoTime?.value;
    modalHandle?.setButtonState('saveEmbargo', { disabled: !(dateValid && timeValid) });
  };

  const items = [
    {
      placeholder: 'YYYY-MM-DD',
      value: date,
      label: t('publishing.embargoDate'),
      field: 'embargoDate',
    },
    {
      placeholder: '12:00 PM',
      value: toDisplayTime(time) || '12:00 PM',
      label: t('publishing.embargoTimeLocal'),
      field: 'embargoTime',
    },
  ];

  const relationships = [
    { control: 'embargoDate', onFocusOut: enableSubmit, onInput: enableSubmit },
    { control: 'embargoTime', onInput: enableSubmit },
  ];

  const content = (elem: HTMLElement) => {
    inputs = renderForm(elem, items, relationships);

    // Attach vanillaJS datePicker to the date field (same as New Tournament form)
    if (inputs?.embargoDate) {
      new Datepicker(inputs.embargoDate as HTMLInputElement, {
        format: 'yyyy-mm-dd',
        language: i18next.language,
        autohide: true,
      });
    }

    if (inputs?.embargoTime) attachTimePicker(inputs.embargoTime as HTMLInputElement);
  };

  const onSave = () => {
    const embargoDate = inputs?.embargoDate?.value;
    const embargoTime = inputs?.embargoTime?.value;
    if (embargoDate && embargoTime) {
      const isoString = venuePartsToGMT(embargoDate, embargoTime);
      if (!isoString) {
        tmxToast({ message: t('publishing.embargoUnreadable'), intent: 'is-danger' });
        return undefined;
      }
      closeModal();
      onSet(isoString);
    }
  };

  const buttons: any[] = [{ label: t('common.cancel'), intent: NONE, close: true }];

  if (currentEmbargo && onClear) {
    buttons.push({
      label: t('publishing.clearEmbargo'),
      intent: 'is-danger',
      onClick: () => {
        closeModal();
        onClear();
      },
    });
  }

  buttons.push({
    label: t('publishing.setEmbargo'),
    id: 'saveEmbargo',
    disabled: !date,
    intent: 'is-primary',
    onClick: onSave,
  });

  modalHandle = openModal({ title: title || t('publishing.setEmbargo'), content, buttons });
}
