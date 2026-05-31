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
import { printSchedule } from 'components/modals/printSchedule';
import { competitionEngine } from 'services/factory/engine';
import { wrapSearchWithClear } from 'courthive-components';
import { buildStepper } from './stepperControl';
import {
  buildToggleIconButton,
  TOGGLE_BG_UNPRESSED,
  TOGGLE_BTN_BASE_STYLE,
} from 'components/buttons/toggleIconButton';

const MIN_ROWS_FLOOR = 1;
const MIN_ROWS_CEILING = 200;

// Shared style fragments — extracted because Sonar flags 3-way literal
// duplication across the print button, the Rows stepper, and the search slot.
const BORDER_RADIUS_6 = 'border-radius: 6px';
const BORDER_PRIMARY = 'border: 1px solid var(--tmx-border-primary)';
const COLOR_PRIMARY = 'color: var(--tmx-color-primary)';

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

  const catalogBtn = buildToggleIconButton({
    icon: 'fa-table-columns',
    pressed: catalogVisible,
    titleOn: 'Hide catalog',
    titleOff: 'Show catalog',
    onChange: onToggleCatalog,
  });

  const stripBtn = buildToggleIconButton({
    icon: 'fa-grip-lines',
    pressed: activeStripVisible,
    titleOn: 'Hide active courts strip',
    titleOff: 'Show active courts strip',
    onChange: onToggleActiveStrip,
  });

  const rowsStepper = buildMinRowsStepper(minRows, onMinRowsChange);

  const printBtn = document.createElement('button');
  printBtn.style.cssText =
    TOGGLE_BTN_BASE_STYLE +
    `; background: ${TOGGLE_BG_UNPRESSED}` +
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
  return buildStepper({
    label: 'Rows',
    initial,
    min: MIN_ROWS_FLOOR,
    max: MIN_ROWS_CEILING,
    title: 'Minimum number of time rows in the schedule grid',
    onChange,
  });
}

