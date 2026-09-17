/**
 * Schedule2 — the Now strip's time-block modal.
 *
 * Successive from/to periods with a type each, written as real bookings on the
 * court's `dateAvailability` — the same shape the Availability tab produces, and
 * therefore the same shape every block reader already understands. See
 * `timeBlockLogic.ts` for why the strip could not keep using the grid's
 * row-based blocking.
 *
 * ── Deliberately not a table ──
 *
 * Each period is one line that reads as a sentence — from, to, type, and a
 * control to remove it — rather than cells under column headings. A table
 * implies a record being maintained; this is a short list being composed, and
 * the first row is usually the only row.
 *
 * ── The first row starts at NOW ──
 *
 * Rounded up to the quarter hour the availability grid itself works in. That
 * default is the entire reason to start from the strip rather than the
 * Availability tab: the operator is looking at a court that is free right now
 * and wants to take it out of service from about now.
 *
 * ── Native time inputs, explicitly themed ──
 *
 * `timePicker` (the timepicker-ui modal) is right for one time and wrong for
 * six: a modal per field, opened from inside a modal. `<input type="time">`
 * keeps the whole list on one screen, and TMX themes native controls explicitly
 * rather than inheriting whatever the platform draws.
 */

import { addBookingsToDateAvailability, roundUpToQuarter, timeBlockError, toClock } from './timeBlockLogic';
import { MODIFY_COURT_AVAILABILITY } from 'constants/mutationConstants';
import { closeModal, openModal } from 'components/modals/baseModal/baseModal';
import { venueNowOnDate } from 'functions/venueTimeFrame';
import { scheduleToast } from './scheduleToast';
import { BookingTypeEnum } from 'tods-competition-factory';
import { NONE } from 'constants/tmxConstants';
import { t } from 'i18n';

// constants and types
import type { TimeBlockRow } from './timeBlockLogic';

/** The court the operator clicked, plus everything else the block could be applied to. */
export interface TimeBlockCourt {
  courtId: string;
  courtName: string;
  dateAvailability: any[];
}

export interface TimeBlockModalParams {
  scheduledDate: string;
  court: TimeBlockCourt;
  /** Every court at the venue, so one weather closure need not be entered six times. */
  allCourts: TimeBlockCourt[];
  execute: (methods: any[]) => void;
}

/** The block types this modal offers, in the order an operator is likely to need them. */
const BLOCK_TYPES = [
  BookingTypeEnum.BLOCKED,
  BookingTypeEnum.MAINTENANCE,
  BookingTypeEnum.DRYING,
  BookingTypeEnum.PRACTICE,
] as string[];

/** A default period: an hour, starting at the next quarter hour. */
function defaultRow(scheduledDate: string): TimeBlockRow {
  const now = venueNowOnDate(scheduledDate);
  // A date the venue has not reached has no "now" on it — open at the start of
  // the working day rather than at an hour derived from another date's clock.
  const startMinutes = now ? roundUpToQuarter(now.getHours() * 60 + now.getMinutes()) : 9 * 60;
  return {
    startTime: toClock(startMinutes),
    endTime: toClock(startMinutes + 60),
    bookingType: BookingTypeEnum.BLOCKED,
  };
}

function timeField(value: string, onChange: (next: string) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'time';
  input.className = 'tmx-timeblock-time';
  input.value = value;
  input.addEventListener('change', () => onChange(input.value));
  return input;
}

function typeField(value: string, onChange: (next: string) => void): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'tmx-timeblock-type';
  for (const type of BLOCK_TYPES) {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = t(`schedule.blockType.${type.toLowerCase()}`);
    select.appendChild(option);
  }
  select.value = value;
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

function label(text: string): HTMLElement {
  const element = document.createElement('span');
  element.className = 'tmx-timeblock-label';
  element.textContent = text;
  return element;
}

/**
 * Open the modal. Returns nothing — the operator's Save dispatches through
 * `execute`, which is the schedule view's own executor so plan mode and bulk
 * mode are honoured exactly as they are everywhere else.
 */
export function openTimeBlockModal(params: TimeBlockModalParams): void {
  const { scheduledDate, court, allCourts, execute } = params;
  const rows: TimeBlockRow[] = [defaultRow(scheduledDate)];
  let applyToAll = false;

  const content = document.createElement('div');
  content.className = 'tmx-timeblock';

  const list = document.createElement('div');
  list.className = 'tmx-timeblock-rows';
  content.appendChild(list);

  const message = document.createElement('div');
  message.className = 'tmx-timeblock-message';

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'tmx-timeblock-add';
  addButton.textContent = t('schedule.timeBlock.addPeriod');

  const scope = document.createElement('label');
  scope.className = 'tmx-timeblock-scope';
  const scopeBox = document.createElement('input');
  scopeBox.type = 'checkbox';
  scopeBox.addEventListener('change', () => {
    applyToAll = scopeBox.checked;
  });
  scope.appendChild(scopeBox);
  scope.appendChild(label(t('schedule.timeBlock.allCourts', { count: allCourts.length })));

  let saveButton: HTMLButtonElement | undefined;

  function refreshValidity(): void {
    const error = timeBlockError(rows);
    message.textContent = error && error !== 'none' ? t(`schedule.timeBlock.error.${error}`) : '';
    if (saveButton) saveButton.disabled = !!error;
  }

  function renderRows(): void {
    list.innerHTML = '';
    rows.forEach((current, index) => {
      const line = document.createElement('div');
      line.className = 'tmx-timeblock-row';

      line.appendChild(label(t('schedule.timeBlock.from')));
      line.appendChild(
        timeField(current.startTime, (next) => {
          current.startTime = next;
          refreshValidity();
        }),
      );
      line.appendChild(label(t('schedule.timeBlock.to')));
      line.appendChild(
        timeField(current.endTime, (next) => {
          current.endTime = next;
          refreshValidity();
        }),
      );
      line.appendChild(typeField(current.bookingType, (next) => (current.bookingType = next)));

      // The only row has nothing to remove: emptying it is what "no block" means,
      // and a control that would leave the modal with no rows at all is a state
      // the operator cannot get back from.
      if (rows.length > 1) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'tmx-timeblock-remove';
        remove.title = t('schedule.timeBlock.removePeriod');
        remove.setAttribute('aria-label', t('schedule.timeBlock.removePeriod'));
        remove.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
        remove.addEventListener('click', () => {
          rows.splice(index, 1);
          renderRows();
          refreshValidity();
        });
        line.appendChild(remove);
      }

      list.appendChild(line);
    });
  }

  addButton.addEventListener('click', () => {
    // A new period starts where the last one ended: successive blocks are far
    // more common than overlapping ones, and it saves the operator retyping a
    // time they just entered.
    const last = rows.at(-1);
    rows.push({
      startTime: last?.endTime ?? '',
      endTime: '',
      bookingType: last?.bookingType ?? BookingTypeEnum.BLOCKED,
    });
    renderRows();
    refreshValidity();
  });

  content.appendChild(message);
  content.appendChild(addButton);
  if (allCourts.length > 1) content.appendChild(scope);

  function save(): void {
    const targets = applyToAll ? allCourts : [court];
    const methods: any[] = [];
    const skipped: string[] = [];

    for (const target of targets) {
      const dateAvailability = addBookingsToDateAvailability(target.dateAvailability, scheduledDate, rows);
      // A court with no open window anywhere cannot carry a booking — the
      // factory rejects an availability entry with no start/end. Say which
      // courts were skipped rather than reporting a partial write as success.
      if (!dateAvailability) {
        skipped.push(target.courtName);
        continue;
      }
      methods.push({ method: MODIFY_COURT_AVAILABILITY, params: { courtId: target.courtId, dateAvailability } });
    }

    if (skipped.length) {
      scheduleToast({ message: t('schedule.timeBlock.noWindow', { courts: skipped.join(', ') }), intent: 'is-danger' });
    }
    if (methods.length) execute(methods);
    closeModal();
  }

  renderRows();

  openModal({
    title: t('schedule.timeBlock.title', { court: court.courtName }),
    content,
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      { label: t('schedule.timeBlock.save'), intent: 'is-info', onClick: save },
    ],
  });

  // The modal's own button element, so validity can drive it. Queried after
  // `openModal` because cModal builds the footer; guarded because a future
  // change to that markup should degrade to "always enabled", not throw.
  saveButton =
    document.querySelector<HTMLButtonElement>('.chc-modal-dialog .chc-modal-footer button:last-of-type') ?? undefined;
  refreshValidity();
}
