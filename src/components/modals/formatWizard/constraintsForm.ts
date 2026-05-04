import { t } from 'i18n';

// constants and types
import { ConsolationAppetite, WizardConstraints } from 'tods-competition-factory';

export interface ConstraintsFormState {
  scaleName: string;
  constraints: WizardConstraints;
}

export interface ConstraintsFormHandle {
  setOnChange: (cb: (state: ConstraintsFormState) => void) => void;
  getState: () => ConstraintsFormState;
  element: HTMLElement;
}

export interface ConstraintsFormOptions {
  initialScaleName?: string;
  initialConstraints?: Partial<WizardConstraints>;
  scaleOptions?: Array<{ value: string; label: string }>;
}

const DEFAULT_SCALE_OPTIONS = [
  { value: 'utr', label: 'UTR' },
  { value: 'wtn', label: 'WTN' },
  { value: 'ntrp', label: 'NTRP' },
];

const DEFAULT_CONSTRAINTS: WizardConstraints = {
  consolationAppetite: 'LIGHT',
  targetCompetitivePct: 0.65,
  minMatchesFloor: 3,
  hoursPerDay: 8,
  courts: 4,
  days: 2,
};

const APPETITE_OPTIONS: ConsolationAppetite[] = ['NONE', 'LIGHT', 'FULL'];

const FIELD_WRAPPER_STYLE = 'display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;';
const LABEL_STYLE = 'font-size: 13px; color: var(--tmx-text-secondary, #555); font-weight: 500;';
const INPUT_STYLE =
  'padding: 6px 8px; border: 1px solid var(--tmx-border-secondary, #ddd); border-radius: 4px; font-size: 14px; background: var(--tmx-bg-primary, #fff); color: var(--tmx-text-primary, #222);';

function buildField(label: string, control: HTMLElement): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = FIELD_WRAPPER_STYLE;
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  labelEl.style.cssText = LABEL_STYLE;
  wrapper.appendChild(labelEl);
  wrapper.appendChild(control);
  return wrapper;
}

function buildSelect(options: Array<{ value: string; label: string }>, value: string): HTMLSelectElement {
  const select = document.createElement('select');
  select.style.cssText = INPUT_STYLE;
  for (const opt of options) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === value) option.selected = true;
    select.appendChild(option);
  }
  return select;
}

function buildNumberInput(value: number, min: number, step: number): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.value = String(value);
  input.min = String(min);
  input.step = String(step);
  input.style.cssText = INPUT_STYLE;
  return input;
}

function clampNumber(value: number, min: number, fallback: number): number {
  if (!Number.isFinite(value) || value < min) return fallback;
  return value;
}

// Builds the left-pane constraints form. The factory returns a handle
// the parent can use to read the current state and subscribe to
// changes. No engine calls happen here — the parent wires `onChange`
// to a recomputation in Phase 1.C.3.
export function buildConstraintsForm(options: ConstraintsFormOptions = {}): ConstraintsFormHandle {
  const scaleOptions = options.scaleOptions ?? DEFAULT_SCALE_OPTIONS;
  const initialScale = options.initialScaleName ?? scaleOptions[0]?.value ?? 'utr';
  const initial: WizardConstraints = { ...DEFAULT_CONSTRAINTS, ...(options.initialConstraints ?? {}) };

  const state: ConstraintsFormState = { scaleName: initialScale, constraints: initial };
  let onChange: ((state: ConstraintsFormState) => void) | undefined;

  const root = document.createElement('div');
  root.className = 'tmx-format-wizard-constraints';
  root.style.cssText =
    'display: flex; flex-direction: column; gap: 4px; padding: 16px; min-width: 280px; border-right: 1px solid var(--tmx-border-secondary, #eee);';

  const scaleSelect = buildSelect(scaleOptions, initialScale);
  const courtsInput = buildNumberInput(initial.courts, 1, 1);
  const daysInput = buildNumberInput(initial.days, 1, 1);
  const hoursInput = buildNumberInput(initial.hoursPerDay ?? 8, 1, 0.5);
  const floorInput = buildNumberInput(initial.minMatchesFloor ?? 3, 1, 1);
  const targetInput = buildNumberInput((initial.targetCompetitivePct ?? 0.65) * 100, 0, 1);
  const appetiteSelect = buildSelect(
    APPETITE_OPTIONS.map((value) => ({ value, label: t(`formatWizard.appetite.${value.toLowerCase()}`) })),
    initial.consolationAppetite ?? 'LIGHT',
  );

  root.appendChild(buildField(t('formatWizard.fields.scale'), scaleSelect));
  root.appendChild(buildField(t('formatWizard.fields.courts'), courtsInput));
  root.appendChild(buildField(t('formatWizard.fields.days'), daysInput));
  root.appendChild(buildField(t('formatWizard.fields.hoursPerDay'), hoursInput));
  root.appendChild(buildField(t('formatWizard.fields.minMatchesFloor'), floorInput));
  root.appendChild(buildField(t('formatWizard.fields.targetCompetitivePct'), targetInput));
  root.appendChild(buildField(t('formatWizard.fields.consolationAppetite'), appetiteSelect));

  function readState(): ConstraintsFormState {
    return {
      scaleName: scaleSelect.value,
      constraints: {
        consolationAppetite: appetiteSelect.value as ConsolationAppetite,
        targetCompetitivePct: clampNumber(Number(targetInput.value) / 100, 0, 0.65),
        minMatchesFloor: clampNumber(Number(floorInput.value), 0, 3),
        hoursPerDay: clampNumber(Number(hoursInput.value), 0.5, 8),
        courts: clampNumber(Number(courtsInput.value), 1, 4),
        days: clampNumber(Number(daysInput.value), 1, 2),
      },
    };
  }

  function notify() {
    const next = readState();
    state.scaleName = next.scaleName;
    state.constraints = next.constraints;
    if (onChange) onChange(next);
  }

  for (const control of [scaleSelect, courtsInput, daysInput, hoursInput, floorInput, targetInput, appetiteSelect]) {
    control.addEventListener('change', notify);
    control.addEventListener('input', notify);
  }

  return {
    setOnChange: (cb) => {
      onChange = cb;
    },
    getState: () => readState(),
    element: root,
  };
}
