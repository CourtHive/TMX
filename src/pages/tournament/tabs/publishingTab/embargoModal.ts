/**
 * Embargo date/time picker modal.
 * Uses renderForm for inputs, vanillajs-datepicker for the date field,
 * and attachTimePicker for time — consistent with patterns used elsewhere in TMX.
 * Local date/time is converted to GMT for storage.
 */
import { venueParts, venueWallClockToMs } from 'functions/venueTimeFrame';
import { attachTimePicker } from 'pages/tournament/tabs/venuesTab/venueTimeHelpers';
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { renderForm, validators } from 'courthive-components';
import { toDisplayTime } from 'components/forms/venue';
import { Datepicker } from 'vanillajs-datepicker';
import { tools } from 'tods-competition-factory';
import { t, i18next } from 'i18n';

import { NONE } from 'constants/tmxConstants';

type EmbargoModalParams = {
  title?: string;
  currentEmbargo?: string;
  onSet: (isoString: string) => void;
  onClear?: () => void;
};

/**
 * An embargo instant → the date and time fields the modal edits, on the
 * **venue's** clock.
 *
 * An embargo is a tournament decision ("hold results until 18:00"), so 18:00
 * means 18:00 at the venue. Read on the operator's clock, a director travelling
 * would set an embargo that lifts at the wrong hour on site — and, because the
 * field round-trips, would silently rewrite the existing one just by opening
 * the modal. This and `venuePartsToGMT` must always move together for that
 * reason: they are one conversion in two directions.
 */
function embargoToLocalParts(isoString?: string): { date: string; time: string } {
  if (!isoString) return { date: '', time: '' };
  const parts = venueParts(isoString);
  if (!parts) return { date: '', time: '' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}

/** The inverse of `embargoToLocalParts` — a venue wall clock back to a UTC instant. */
function venuePartsToGMT(date: string, time12h: string): string {
  const militaryTime = tools.dateTime.convertTime(time12h, true) || time12h;
  const ms = venueWallClockToMs(date, militaryTime || '12:00');
  if (ms === undefined) return new Date().toISOString();
  return new Date(ms).toISOString();
}

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
