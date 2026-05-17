/**
 * Grid Header Actions — controls injected into the courthive-components
 * court-grid header slot:
 *   - leading: catalog show/hide toggle
 *   - titleSlot: schedule-wide search input (replaces the default "Court Grid"
 *     label so the header reads as a single clean search field)
 *   - trailing: active-strip toggle, rows stepper, print
 *
 * Each control manages its own visual state (aria-pressed, opacity, label).
 * Toggle callbacks receive the new state; the consumer persists + applies it.
 */
import { competitionEngine } from 'tods-competition-factory';
import { wrapSearchWithClear } from 'courthive-components';
import { printSchedule } from 'components/modals/printSchedule';

const ARIA_PRESSED = 'aria-pressed';

const MIN_ROWS_FLOOR = 1;
const MIN_ROWS_CEILING = 200;

// Shared style fragments — extracted because Sonar flags 3-way literal
// duplication across BTN_BASE_STYLE, the Rows stepper, and the search slot.
const BORDER_RADIUS_6 = 'border-radius: 6px';
const BORDER_PRIMARY = 'border: 1px solid var(--tmx-border-primary)';
const COLOR_PRIMARY = 'color: var(--tmx-color-primary)';

const BTN_BASE_STYLE = [
  'font-size: 0.75rem',
  'padding: 4px 8px',
  BORDER_RADIUS_6,
  BORDER_PRIMARY,
  COLOR_PRIMARY,
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
  onSearch: (text: string) => void;
}

export interface GridHeaderActions {
  /** Rendered immediately before the title slot — co-located with the
   *  catalog it controls (left column). */
  leading: HTMLElement[];
  /** Element rendered in place of the default "Court Grid" title — the
   *  schedule-wide search input. */
  titleSlot: HTMLElement;
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
    onSearch,
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

  return {
    leading: [catalogBtn],
    titleSlot: buildSearchSlot(onSearch),
    trailing: [stripBtn, rowsStepper, printBtn],
  };
}

// ── Search slot ──

/**
 * Schedule-wide search input that replaces the default "Court Grid" title.
 * Debounces input by 200ms before invoking the callback; click/Escape via
 * wrapSearchWithClear clears immediately. Stretches to fill available space
 * in the header's flex layout so the search reads as the prominent action.
 */
function buildSearchSlot(onSearch: (text: string) => void): HTMLElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search schedule…';
  input.style.cssText = [
    'font-size: 0.8125rem',
    'padding: 4px 10px',
    BORDER_RADIUS_6,
    BORDER_PRIMARY,
    'background: var(--tmx-bg-primary)',
    COLOR_PRIMARY,
    'width: 260px',
    'max-width: 100%',
  ].join('; ');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  const fire = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => onSearch(input.value), 200);
  };
  input.addEventListener('input', fire);

  const slot = wrapSearchWithClear(input, () => {
    input.value = '';
    onSearch('');
    input.focus();
  });
  // The slot defaults to `flex: 1` so it stretches; override with a fixed
  // width so the trailing actions don't get pushed off-screen on narrow
  // viewports. min-width: 0 still lets it shrink below its content if the
  // header is squeezed.
  slot.style.flex = '0 0 auto';
  return slot;
}

// ── Min-rows Stepper ──

function buildMinRowsStepper(initial: number, onChange: (rows: number) => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.title = 'Minimum number of time rows in the schedule grid';
  wrap.style.cssText = [
    'display: inline-flex',
    'align-items: center',
    'gap: 2px',
    BORDER_RADIUS_6,
    BORDER_PRIMARY,
    'overflow: hidden',
    'height: 26px',
  ].join('; ');

  const label = document.createElement('span');
  label.textContent = 'Rows';
  label.style.cssText = `font-size: 0.6875rem; padding: 0 6px 0 8px; ${COLOR_PRIMARY}; align-items: center; display: inline-flex; height: 100%;`;
  wrap.appendChild(label);

  let current = clampRows(initial);

  const minus = makeStepperButton('−');
  const plus = makeStepperButton('+');

  const value = document.createElement('span');
  value.style.cssText = `font-size: 0.75rem; font-weight: 600; min-width: 22px; text-align: center; ${COLOR_PRIMARY}; align-items: center; display: inline-flex; justify-content: center; height: 100%;`;
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
    COLOR_PRIMARY,
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
