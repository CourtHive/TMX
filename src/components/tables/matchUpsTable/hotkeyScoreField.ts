import { isPointsTotalFormat } from 'functions/isPointsTotalFormat';
import { preferencesConfig } from 'config/preferencesConfig';
import { hasFinalResult } from 'functions/hasFinalResult';
import { deviceConfig } from 'config/deviceConfig';
import { t } from 'i18n';

/** The score cells that take keypad entry while hotkey entry mode is on. */
export const HOTKEY_FIELD = 'hotkeyScoreField';

/** Hotkey entry mode: the matchUps-page toggle (the `hotkeys` preference); never on a mobile device. */
export function isHotkeyEntryMode(): boolean {
  return !!preferencesConfig.get().hotkeys && !deviceConfig.get().isMobile;
}

/**
 * A matchUp whose score cell becomes an entry field: ready to score, without a final result, and not a
 * combined-point total, which the keypad cannot enter (SET1-S:P32 opens the score dialog instead).
 */
export function takesHotkeyEntry(matchUp: any): boolean {
  return !!matchUp?.readyToScore && !hasFinalResult(matchUp) && !isPointsTotalFormat(matchUp?.matchUpFormat);
}

/**
 * The score cell as an entry field. Focus (click or Tab) hands the cell to the keypad; the typed score is written
 * into the field by `hotKeyScoring`, and Enter saves it and moves to the next field.
 */
export function hotkeyScoreField(cell: any, onFocus: (cell: any) => void): HTMLElement {
  const data = cell.getRow().getData();
  const field = document.createElement('div');
  field.className = HOTKEY_FIELD;
  field.tabIndex = 0;
  field.dataset.matchUpId = data.matchUp.matchUpId;
  if (data.score) {
    field.textContent = data.score;
  } else {
    field.textContent = t('pages.matchUps.hotkeyPlaceholder');
    field.classList.add('is-placeholder');
  }
  field.addEventListener('focus', () => onFocus(cell));
  return field;
}

/** The entry fields in table order. */
export function hotkeyFields(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(`.${HOTKEY_FIELD}`));
}

/** Focus the field after (or before) `from`, if there is one. */
export function focusAdjacentField(from: Element | undefined, step: 1 | -1): void {
  const fields = hotkeyFields();
  const index = from ? fields.indexOf(from as HTMLElement) : -1;
  fields[index + step]?.focus();
}

/**
 * Focus the field for `matchUpId` once the table has re-rendered after a save, trying for a few frames because
 * Tabulator replaces the rows asynchronously.
 */
export function focusFieldWhenRendered(matchUpId: string | undefined, framesLeft = 30): void {
  if (!matchUpId) return;
  const field = document.querySelector<HTMLElement>(`.${HOTKEY_FIELD}[data-match-up-id="${matchUpId}"]`);
  if (field) {
    field.focus();
    return;
  }
  if (framesLeft > 0) requestAnimationFrame(() => focusFieldWhenRendered(matchUpId, framesLeft - 1));
}

/** Focus the first entry field once the table has redrawn (switching the mode on). */
export function focusFirstFieldWhenRendered(framesLeft = 30): void {
  const [first] = hotkeyFields();
  if (first) {
    first.focus();
    return;
  }
  if (framesLeft > 0) requestAnimationFrame(() => focusFirstFieldWhenRendered(framesLeft - 1));
}
