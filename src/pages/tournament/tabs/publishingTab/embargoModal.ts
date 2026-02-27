/**
 * Embargo date/time picker modal.
 * Uses renderForm for inputs, vanillajs-datepicker for the date field,
 * and attachTimePicker for time — consistent with patterns used elsewhere in TMX.
 * Local date/time is converted to GMT for storage.
 */
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { attachTimePicker } from 'pages/tournament/tabs/venuesTab/venueTimeHelpers';
import { Datepicker } from 'vanillajs-datepicker';
import { toDisplayTime } from 'components/forms/venue';
import { renderForm, validators } from 'courthive-components';
import { tools } from 'tods-competition-factory';
import { t } from 'i18n';

import { NONE } from 'constants/tmxConstants';

type EmbargoModalParams = {
  title?: string;
  currentEmbargo?: string;
  onSet: (isoString: string) => void;
  onClear?: () => void;
};

function embargoToLocalParts(isoString?: string): { date: string; time: string } {
  if (!isoString) return { date: '', time: '' };
  const d = new Date(isoString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}

function localPartsToGMT(date: string, time12h: string): string {
  const militaryTime = tools.dateTime.convertTime(time12h, true) || time12h;
  const [hours, minutes] = (militaryTime || '12:00').split(':').map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(hours || 0, minutes || 0, 0, 0);
  return d.toISOString();
}

export function openEmbargoModal({ title, currentEmbargo, onSet, onClear }: EmbargoModalParams): void {
  const { date, time } = embargoToLocalParts(currentEmbargo);

  let inputs: any;

  const enableSubmit = () => {
    const dateValid = validators.dateValidator(inputs?.embargoDate?.value);
    const timeValid = !!inputs?.embargoTime?.value;
    const saveButton = document.getElementById('saveEmbargo');
    if (saveButton) (saveButton as HTMLButtonElement).disabled = !(dateValid && timeValid);
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
        autohide: true,
      });
    }

    if (inputs?.embargoTime) attachTimePicker(inputs.embargoTime as HTMLInputElement);
  };

  const onSave = () => {
    const embargoDate = inputs?.embargoDate?.value;
    const embargoTime = inputs?.embargoTime?.value;
    if (embargoDate && embargoTime) {
      const isoString = localPartsToGMT(embargoDate, embargoTime);
      closeModal();
      onSet(isoString);
    }
  };

  const buttons: any[] = [
    { label: t('common.cancel'), intent: NONE, close: true },
  ];

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

  openModal({ title: title || t('publishing.setEmbargo'), content, buttons });
}
