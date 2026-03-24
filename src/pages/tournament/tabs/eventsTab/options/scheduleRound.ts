/**
 * Schedule Round modal — bulk-schedule all matchUps in a round.
 * Presents a date picker (constrained to activeDates, excluding dates before
 * previously scheduled rounds) and an optional time picker.
 */
import { getScheduleDateRange } from 'pages/tournament/tabs/scheduleUtils';
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { Datepicker } from 'vanillajs-datepicker';
import { TimepickerUI } from 'timepicker-ui';
import { tools } from 'tods-competition-factory';
import { i18next } from 'i18n';

import { BULK_SCHEDULE_MATCHUPS } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

type ScheduleRoundParams = {
  roundNumber: number;
  structureId: string;
  drawId: string;
  eventData: any;
  callback?: (params?: any) => void;
};

export function scheduleRound(params: ScheduleRoundParams): void {
  const { roundNumber, structureId, drawId, eventData, callback } = params;

  const structure = eventData?.drawsData
    ?.find((dd: any) => dd.drawId === drawId)
    ?.structures?.find((s: any) => s.structureId === structureId);
  if (!structure) return;

  const roundMatchUps = structure.roundMatchUps?.[roundNumber];
  if (!roundMatchUps?.length) return;

  const matchUpIds = roundMatchUps.map((m: any) => m.matchUpId);
  const activeDates = getAvailableDates(structure, roundNumber);

  if (!activeDates.length) return;

  let selectedDate = activeDates[0];
  let selectedTime = '';

  const content = (elem: HTMLElement) => {
    // Date field
    const dateLabel = document.createElement('label');
    dateLabel.className = 'label';
    dateLabel.textContent = 'Date';
    elem.appendChild(dateLabel);

    const dateInput = document.createElement('input');
    dateInput.type = 'text';
    dateInput.className = 'input';
    dateInput.value = selectedDate;
    dateInput.placeholder = 'YYYY-MM-DD';
    dateInput.readOnly = true;
    elem.appendChild(dateInput);

    const activeDatesSet = new Set(activeDates);
    new Datepicker(dateInput, {
      format: 'yyyy-mm-dd',
      language: i18next.language,
      autohide: false,
      todayHighlight: true,
      datesDisabled: (dpDate: Date) => {
        const y = dpDate.getFullYear();
        const m = String(dpDate.getMonth() + 1).padStart(2, '0');
        const d = String(dpDate.getDate()).padStart(2, '0');
        return !activeDatesSet.has(`${y}-${m}-${d}`);
      },
      minDate: activeDates[0],
      maxDate: activeDates.at(-1),
    });

    dateInput.addEventListener('changeDate', () => {
      selectedDate = dateInput.value;
    });

    // Time field (optional)
    const timeLabel = document.createElement('label');
    timeLabel.className = 'label';
    timeLabel.style.marginTop = '0.75rem';
    timeLabel.textContent = 'Time (optional)';
    elem.appendChild(timeLabel);

    const timeWrapper = document.createElement('div');
    timeWrapper.style.position = 'relative';
    elem.appendChild(timeWrapper);

    const timeInput = document.createElement('input');
    timeInput.type = 'text';
    timeInput.className = 'input timepicker-ui-input';
    timeInput.placeholder = 'Click to set time';
    timeInput.readOnly = true;
    timeWrapper.appendChild(timeInput);

    // defer timepicker-ui init so DOM is ready
    requestAnimationFrame(() => {
      const tpu = new TimepickerUI(timeWrapper, {
        clock: { type: '12h', autoSwitchToMinutes: true },
        callbacks: {
          onConfirm: () => {
            selectedTime = timeInput.value;
          },
        },
      });
      tpu.create();
    });
  };

  const onSubmit = () => {
    if (!selectedDate) return;

    const schedule: any = { scheduledDate: selectedDate };
    if (selectedTime) {
      schedule.scheduledTime = tools.dateTime.convertTime(selectedTime, true) || '';
    }

    const methods = [
      {
        params: { matchUpIds, schedule, removePriorValues: true },
        method: BULK_SCHEDULE_MATCHUPS,
      },
    ];

    closeModal();
    mutationRequest({
      methods,
      callback: (result: any) => {
        if (result?.success && callback) callback();
      },
    });
  };

  openModal({
    title: 'Schedule Round',
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      { label: 'Submit', intent: 'is-primary', onClick: onSubmit },
    ],
  });
}

/**
 * Returns activeDates filtered to exclude dates earlier than the latest
 * scheduledDate of any previously completed/scheduled round.
 */
function getAvailableDates(structure: any, roundNumber: number): string[] {
  const activeDates = getScheduleDateRange();
  if (!activeDates.length) return [];

  // Find the latest scheduledDate from any round before this one
  let latestPriorDate = '';
  const roundMatchUps = structure.roundMatchUps || {};
  for (const key of Object.keys(roundMatchUps)) {
    const rn = Number(key);
    if (rn >= roundNumber) continue;
    for (const matchUp of roundMatchUps[key]) {
      const sd = matchUp?.schedule?.scheduledDate;
      if (sd && sd > latestPriorDate) latestPriorDate = sd;
    }
  }

  if (!latestPriorDate) return activeDates;
  return activeDates.filter((d) => d >= latestPriorDate);
}
