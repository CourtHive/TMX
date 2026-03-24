/**
 * Date picker modal for selecting a schedule date.
 * Uses vanillajs-datepicker with optional activeDates constraint.
 */
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { Datepicker } from 'vanillajs-datepicker';
import { i18next } from 'i18n';

import { NONE } from 'constants/tmxConstants';

type DatePickerParams = {
  date?: string;
  activeDates?: string[];
  callback?: (result: { date: string }) => void;
};

export function datePicker({ date, activeDates, callback }: DatePickerParams): void {
  let selectedDate = date || '';
  const content = (elem: HTMLElement) => {
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
    title: 'Select date',
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Ok', intent: 'is-primary', onClick: onSave },
    ],
  });
}
