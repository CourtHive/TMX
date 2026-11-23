/**
 * Date picker modal for selecting a schedule date.
 * Uses vanillajs-datepicker with optional activeDates constraint.
 */
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { Datepicker } from 'vanillajs-datepicker';
import { i18next, t } from 'i18n';

import { NONE } from 'constants/tmxConstants';

type DatePickerParams = {
  date?: string;
  activeDates?: string[];
  /** why some dates are not offered (shown above the picker), e.g. a linked matchUp's date bounds this one */
  notes?: string[];
  callback?: (result: { date: string }) => void;
};

export function datePicker({ date, activeDates, notes, callback }: DatePickerParams): void {
  let selectedDate = date || '';
  const content = (elem: HTMLElement) => {
    for (const text of notes ?? []) {
      const note = document.createElement('p');
      note.className = 'tmx-date-picker-note';
      note.textContent = text;
      elem.appendChild(note);
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input';
    input.value = selectedDate;
    input.placeholder = 'YYYY-MM-DD';
    input.readOnly = true;
    elem.appendChild(input);

    const activeDatesSet = activeDates?.length ? new Set(activeDates) : undefined;

    new Datepicker(input, {
      format: 'yyyy-mm-dd',
      language: i18next.language,
      autohide: false,
      todayHighlight: true,
      ...(activeDatesSet && {
        datesDisabled: (dpDate: Date) => {
          const y = dpDate.getFullYear();
          const m = String(dpDate.getMonth() + 1).padStart(2, '0');
          const d = String(dpDate.getDate()).padStart(2, '0');
          return !activeDatesSet.has(`${y}-${m}-${d}`);
        },
        minDate: activeDates?.[0],
        maxDate: activeDates?.at(-1),
      }),
    });

    input.addEventListener('changeDate', () => {
      selectedDate = input.value;
    });
  };

  const onSave = () => {
    closeModal();
    if (selectedDate && callback) {
      callback({ date: selectedDate });
    }
  };

  openModal({
    title: t('drawActions.selectDate'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      { label: t('ui.ok'), intent: 'is-primary', onClick: onSave },
    ],
  });
}
