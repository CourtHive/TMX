/**
 * Shared time helpers for venue drawers (add / edit).
 *
 * Provides:
 * - Military ↔ display time conversion
 * - Inline error display that mirrors renderForm validator behaviour
 * - timePicker attachment (readonly input → modal)
 * - createTimeOrderValidator factory for the auto-adjustment relationship
 *
 * Time-range behaviour mirrors the tournament date-range pattern:
 * - Moving start past end auto-adjusts end to start + 1 h (capped at 23:59)
 * - Moving end before start auto-adjusts start to end − 1 h (floored at end if < 00:00)
 * - Equal times show inline error text beneath both fields
 */
import { timePicker } from 'components/modals/timePicker';
import { toDisplayTime } from 'components/forms/venue';
import { tools } from 'tods-competition-factory';
import { t } from 'i18n';

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

export function toMilitaryTime(time12h: string): string {
  return tools.dateTime.convertTime(time12h, true) || time12h;
}

export function militaryToMinutes(military: string): number {
  const [h, m] = military.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesToDisplayTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(minutes, 1439));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  const hh = h.toString().padStart(2, '0');
  const mm = m.toString().padStart(2, '0');
  return toDisplayTime(`${hh}:${mm}`);
}

// ---------------------------------------------------------------------------
// Inline error — mirrors the renderForm validator (is-danger / is-success)
// ---------------------------------------------------------------------------

export function setTimeFieldError(input: HTMLInputElement, hasError: boolean): void {
  const helpEl = input.parentElement?.querySelector('.help');
  if (helpEl) {
    helpEl.innerHTML = hasError ? (input.dataset.errorText || '') : '';
    helpEl.classList.toggle('is-danger', hasError);
  }
  input.classList.toggle('is-danger', hasError);
  input.classList.toggle('is-success', !hasError);
}

// ---------------------------------------------------------------------------
// TimePicker attachment
// ---------------------------------------------------------------------------

export function attachTimePicker(input: HTMLInputElement): void {
  input.readOnly = true;
  input.style.cursor = 'pointer';
  input.dataset.errorText = t('pages.venues.addVenue.timeOrderError');

  input.addEventListener('click', () => {
    timePicker({
      time: input.value,
      callback: ({ time }) => {
        input.value = time;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Time-order relationship handler factory
// ---------------------------------------------------------------------------

/**
 * Returns an `onInput` relationship handler that auto-adjusts opposing time
 * fields and toggles inline errors.  Calls `enableSubmit` at the end so the
 * parent form can re-evaluate button state.
 */
export function createTimeOrderValidator(enableSubmit: (params: any) => void) {
  return ({ e, inputs }: any) => {
    const startInput = inputs?.defaultStartTime as HTMLInputElement | undefined;
    const endInput = inputs?.defaultEndTime as HTMLInputElement | undefined;
    if (!startInput?.value || !endInput?.value) return;

    const startMin = militaryToMinutes(toMilitaryTime(startInput.value));
    const endMin = militaryToMinutes(toMilitaryTime(endInput.value));
    const changedStart = e?.target === startInput;

    if (changedStart && startMin > endMin) {
      // Start crossed past end — push end forward (cap at 23:59)
      endInput.value = minutesToDisplayTime(Math.min(startMin + 60, 1439));
    } else if (!changedStart && endMin < startMin) {
      // End crossed before start — pull start back (floor at end time when < 00:00)
      startInput.value = minutesToDisplayTime(endMin >= 60 ? endMin - 60 : endMin);
    }

    // Re-evaluate after any adjustment
    const finalStartMin = militaryToMinutes(toMilitaryTime(startInput.value));
    const finalEndMin = militaryToMinutes(toMilitaryTime(endInput.value));
    const timesEqual = finalStartMin === finalEndMin;

    setTimeFieldError(startInput, timesEqual);
    setTimeFieldError(endInput, timesEqual);

    enableSubmit({ inputs });
  };
}
