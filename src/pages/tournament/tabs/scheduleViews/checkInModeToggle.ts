/**
 * Header control for the call-to-court prompt mode (On / Off / Auto).
 *
 * A single cycling button rather than three radios or a select: it is a rarely-touched preference
 * whose current value matters more than its options, and the grid header is a dense row where a
 * select would cost width the court columns need.
 *
 * **Off is the default and the resting state**, so the button must read as inert there — the desk
 * that never opens this should not see a lit control implying something is switched on. Only `on`
 * and `auto` carry colour.
 *
 * The mode gates *prompting only*. The `1/2` badge is deliberately never gated by it: it is already
 * self-gating, appearing only once somebody has checked in. See `checkInPromptMode.ts`.
 */

import { CHECK_IN_PROMPT_MODES } from 'services/checkIn/checkInPromptMode';
import { readCheckInPromptMode, writeCheckInPromptMode } from './gridViewStorage';
import { t } from 'i18n';

// constants and types
import type { CheckInPromptMode } from 'services/checkIn/checkInPromptMode';

/** Next mode in the cycle. Pure so the ordering is testable without a DOM. */
export function nextCheckInPromptMode(current: CheckInPromptMode): CheckInPromptMode {
  const index = CHECK_IN_PROMPT_MODES.indexOf(current);
  return CHECK_IN_PROMPT_MODES[(index + 1) % CHECK_IN_PROMPT_MODES.length];
}

/** Glyph per mode — a filled bell for on, a struck bell for off, a half bell for auto. */
export function checkInModeGlyph(mode: CheckInPromptMode): string {
  if (mode === 'on') return '\u{1F514}';
  if (mode === 'auto') return '\u{1F50D}';
  return '\u{1F515}';
}

function paint(button: HTMLButtonElement, mode: CheckInPromptMode): void {
  button.dataset.checkInMode = mode;
  button.className = `tmx-checkin-mode-toggle is-${mode}`;
  button.textContent = checkInModeGlyph(mode);
  // Keys hoisted out of the template: sonarjs/no-nested-template-literals, and it reads better.
  const label = t('checkIn.promptMode.label');
  const name = t(`checkIn.promptMode.${mode}`);
  const hint = t(`checkIn.promptMode.${mode}Hint`);
  const summary = `${label}: ${name}`;

  button.title = `${summary}\n${hint}`;
  button.setAttribute('aria-label', summary);
}

/**
 * The header button. `onChange` lets the caller repaint anything mode-dependent; the badge is not
 * mode-dependent, so today nothing needs it beyond persistence.
 */
export function buildCheckInModeToggle(onChange?: (mode: CheckInPromptMode) => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  paint(button, readCheckInPromptMode());

  button.addEventListener('click', () => {
    const mode = nextCheckInPromptMode(readCheckInPromptMode());
    writeCheckInPromptMode(mode);
    paint(button, mode);
    onChange?.(mode);
  });

  return button;
}
