/**
 * Grid Header Actions — three icon buttons (catalog, active strip, print)
 * injected into the courthive-components court-grid header slot.
 *
 * During the test phase these run alongside the equivalent icons in
 * schedule2Header.ts so the UX can be compared before removal.
 *
 * Each button manages its own visual state (aria-pressed, opacity, title).
 * Toggle callbacks receive the new state; the consumer persists + applies it.
 */
import { competitionEngine } from 'tods-competition-factory';
import { printSchedule } from 'components/modals/printSchedule';

const ARIA_PRESSED = 'aria-pressed';

const MIN_ROWS_FLOOR = 1;
const MIN_ROWS_CEILING = 200;

const BTN_BASE_STYLE = [
  'font-size: 0.75rem',
  'padding: 4px 8px',
  'border-radius: 6px',
  'border: 1px solid var(--tmx-border-primary)',
  'color: var(--tmx-color-primary)',
  'cursor: pointer',
  'display: inline-flex',
  'align-items: center',
  'gap: 4px',
  'transition: background 0.15s, opacity 0.15s, color 0.15s',
].join('; ');

// Tinted accent fill when pressed (icon-density-agnostic — both fa-table-columns
// and fa-grip-lines read as "on" the same way, regardless of stroke weight).
const BG_PRESSED = 'rgba(59, 130, 246, 0.18)';
const BG_UNPRESSED = 'transparent';

export interface GridHeaderActionsParams {
  selectedDate: string;
  bulkMode: boolean;
  catalogVisible: boolean;
  activeStripVisible: boolean;
  minRows: number;
  onToggleCatalog: (visible: boolean) => void;
  onToggleActiveStrip: (visible: boolean) => void;
  onMinRowsChange: (rows: number) => void;
}

export interface GridHeaderActions {
  /** Rendered immediately before the "Court Grid" title — co-located with the
   *  catalog it controls (left column). */
  leading: HTMLElement[];
  /** Rendered right-aligned in the header — actions that operate on the grid itself. */
  trailing: HTMLElement[];
}

export function buildGridHeaderActions(params: GridHeaderActionsParams): GridHeaderActions {
  const {
    selectedDate,
    bulkMode,
    catalogVisible,
    activeStripVisible,
    minRows,
    onToggleCatalog,
    onToggleActiveStrip,
    onMinRowsChange,
  } = params;

  const catalogBtn = buildToggleButton({
    icon: 'fa-table-columns',
    pressed: catalogVisible,
    titleOn: 'Hide catalog',
    titleOff: 'Show catalog',
    onChange: onToggleCatalog,
  });

  const stripBtn = buildToggleButton({
    icon: 'fa-grip-lines',
    pressed: activeStripVisible,
    titleOn: 'Hide active courts strip',
    titleOff: 'Show active courts strip',
    onChange: onToggleActiveStrip,
  });

  const rowsStepper = buildMinRowsStepper(minRows, onMinRowsChange);

  const printBtn = document.createElement('button');
  printBtn.style.cssText =
    BTN_BASE_STYLE +
    `; background: ${BG_UNPRESSED}` +
    (bulkMode ? '; opacity: 0.45; cursor: not-allowed' : '; color: var(--tmx-accent-blue, #3b82f6)');
  printBtn.innerHTML = '<i class="fa-solid fa-print" style="font-size: 0.75rem;"></i>';
  printBtn.title = bulkMode ? 'Exit bulk mode to print the saved schedule' : 'Print schedule';
  printBtn.disabled = bulkMode;
  printBtn.addEventListener('click', () => {
    if (bulkMode) return;
    const matchUpFilters = { localPerspective: true, scheduledDate: selectedDate };
    const result = competitionEngine.competitionScheduleMatchUps({
      courtCompletedMatchUps: true,
      withCourtGridRows: true,
      minCourtGridRows: 10,
      nextMatchUps: true,
      matchUpFilters,
    });
    const { courtsData = [], rows = [] } = result;
    printSchedule({ scheduledDate: selectedDate, courts: courtsData, rows });
  });

  return { leading: [catalogBtn], trailing: [stripBtn, rowsStepper, printBtn] };
}

// ── Min-rows Stepper ──

function buildMinRowsStepper(initial: number, onChange: (rows: number) => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.title = 'Minimum number of time rows in the schedule grid';
  wrap.style.cssText = [
    'display: inline-flex',
    'align-items: center',
    'gap: 2px',
    'border-radius: 6px',
    'border: 1px solid var(--tmx-border-primary)',
    'overflow: hidden',
    'height: 26px',
  ].join('; ');

  const label = document.createElement('span');
  label.textContent = 'Rows';
  label.style.cssText =
    'font-size: 0.6875rem; padding: 0 6px 0 8px; color: var(--tmx-color-primary); align-items: center; display: inline-flex; height: 100%;';
  wrap.appendChild(label);

  let current = clampRows(initial);

  const minus = makeStepperButton('−');
  const plus = makeStepperButton('+');

  const value = document.createElement('span');
  value.style.cssText =
    'font-size: 0.75rem; font-weight: 600; min-width: 22px; text-align: center; color: var(--tmx-color-primary); align-items: center; display: inline-flex; justify-content: center; height: 100%;';
  value.textContent = String(current);

  const apply = (next: number) => {
    const clamped = clampRows(next);
    if (clamped === current) return;
    current = clamped;
    value.textContent = String(clamped);
    onChange(clamped);
  };

  minus.addEventListener('click', () => apply(current - 1));
  plus.addEventListener('click', () => apply(current + 1));

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
    'color: var(--tmx-color-primary)',
    'cursor: pointer',
    'padding: 0',
  ].join('; ');
  return btn;
}

function clampRows(value: number): number {
  if (!Number.isFinite(value)) return MIN_ROWS_FLOOR;
  return Math.max(MIN_ROWS_FLOOR, Math.min(MIN_ROWS_CEILING, Math.floor(value)));
}

interface ToggleButtonParams {
  icon: string;
  pressed: boolean;
  titleOn: string;
  titleOff: string;
  onChange: (pressed: boolean) => void;
}

function buildToggleButton(params: ToggleButtonParams): HTMLButtonElement {
  const { icon, pressed: initial, titleOn, titleOff, onChange } = params;
  const btn = document.createElement('button');
  btn.style.cssText = BTN_BASE_STYLE;
  btn.innerHTML = `<i class="fa-solid ${icon}" style="font-size: 0.75rem;"></i>`;
  applyState(btn, initial, titleOn, titleOff);
  btn.addEventListener('click', () => {
    const wasPressed = btn.getAttribute(ARIA_PRESSED) === 'true';
    const next = !wasPressed;
    applyState(btn, next, titleOn, titleOff);
    onChange(next);
  });
  return btn;
}

function applyState(btn: HTMLButtonElement, pressed: boolean, titleOn: string, titleOff: string): void {
  btn.setAttribute(ARIA_PRESSED, pressed ? 'true' : 'false');
  btn.style.background = pressed ? BG_PRESSED : BG_UNPRESSED;
  btn.style.opacity = pressed ? '1' : '0.45';
  btn.title = pressed ? titleOn : titleOff;
}
