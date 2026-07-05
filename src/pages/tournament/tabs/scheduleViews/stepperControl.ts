/**
 * Shared stepper control — a small inline group of "label [−] N [+]" used in
 * the schedule2 grid header (Rows) and footer (Min Width). Centralizes the
 * border + button styling so both steppers stay visually identical.
 */

const BORDER_RADIUS_6 = 'border-radius: 6px';
const BORDER_PRIMARY = 'border: 1px solid var(--tmx-border-primary)';
const COLOR_PRIMARY = 'color: var(--tmx-color-primary)';

export interface StepperOptions {
  label: string;
  initial: number;
  min: number;
  max: number;
  step?: number;
  title?: string;
  /** Optional suffix appended to the displayed value (e.g. "px"). */
  suffix?: string;
  onChange: (value: number) => void;
}

export function buildStepper(options: StepperOptions): HTMLElement {
  const { label, initial, min, max, step = 1, title, suffix = '', onChange } = options;

  const wrap = document.createElement('div');
  if (title) wrap.title = title;
  wrap.style.cssText = [
    'display: inline-flex',
    'align-items: center',
    'gap: 2px',
    BORDER_RADIUS_6,
    BORDER_PRIMARY,
    'overflow: hidden',
    'height: 26px',
  ].join('; ');

  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  labelEl.style.cssText = `font-size: 0.6875rem; padding: 0 6px 0 8px; ${COLOR_PRIMARY}; align-items: center; display: inline-flex; height: 100%;`;
  wrap.appendChild(labelEl);

  let current = clamp(initial, min, max);

  const minus = makeStepperButton('−');
  const plus = makeStepperButton('+');

  const value = document.createElement('span');
  value.style.cssText = `font-size: 0.75rem; font-weight: 600; min-width: 22px; text-align: center; ${COLOR_PRIMARY}; align-items: center; display: inline-flex; justify-content: center; height: 100%; padding: 0 4px;`;
  value.textContent = `${current}${suffix}`;

  const syncBoundsState = () => {
    setButtonDisabled(minus, current <= min);
    setButtonDisabled(plus, current >= max);
  };
  syncBoundsState();

  const apply = (next: number) => {
    const clamped = clamp(next, min, max);
    if (clamped === current) return;
    current = clamped;
    value.textContent = `${clamped}${suffix}`;
    syncBoundsState();
    onChange(clamped);
  };

  minus.addEventListener('click', () => apply(current - step));
  plus.addEventListener('click', () => apply(current + step));

  wrap.appendChild(minus);
  wrap.appendChild(value);
  wrap.appendChild(plus);
  return wrap;
}

function makeStepperButton(symbol: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = symbol;
  btn.style.cssText = [
    'font-size: 0.875rem',
    'font-weight: 600',
    'width: 22px',
    'height: 100%',
    'border: 0',
    'background: transparent',
    COLOR_PRIMARY,
    'cursor: pointer',
    'padding: 0',
    'transition: opacity 0.15s',
  ].join('; ');
  return btn;
}

function setButtonDisabled(btn: HTMLButtonElement, disabled: boolean): void {
  btn.disabled = disabled;
  btn.style.opacity = disabled ? '0.3' : '1';
  btn.style.cursor = disabled ? 'not-allowed' : 'pointer';
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
