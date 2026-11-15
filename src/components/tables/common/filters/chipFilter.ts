/**
 * A filter whose values are chips that toggle (CA 2026-11-08): [Singles] [Doubles] [Team], or the four
 * competitiveness profiles, where any combination can be on.
 *
 *   - values combine with OR within the filter; filters combine with AND, as Tabulator applies each filter
 *   - every chip on and no chip on mean the same thing: no filter. The state is `undefined` then
 *   - with every chip on, a click selects that chip alone: one click to "to be played", as a chart legend
 *     isolates a series and as a competitiveness bar segment selects its profile. After that, clicks toggle
 *   - turning off the last chip that is on turns them all back on, so a chip filter never empties the table
 *
 * The selection is saved through `persist`, so it survives leaving and returning to the tab.
 */
import { whenTableBuilt } from 'components/tables/common/whenTableBuilt';

/** `color` and `ink`: the chip's fill when on and its text on that fill; absent, the accent */
export type ChipOption = { label: string; value: string; color?: string; ink?: string };

export type ChipSection = {
  options: ChipOption[];
  isOn: (value: string) => boolean;
  toggle: (value: string) => void;
  clear: () => void;
};

type ChipFilterArgs = {
  table: any;
  /** every value a chip is offered for */
  values: string[];
  /** a row passes when it matches any selected value */
  matches: (rowData: any, value: string) => boolean;
  /** the saved selection, as `persist` last received it */
  initial?: string[];
  persist: (selected: string[] | undefined) => void;
  /** after every change, so a second surface showing the same chips (the matchUps footer) can repaint */
  onChange?: () => void;
};

export type ChipFilter = {
  isOn: (value: string) => boolean;
  toggle: (value: string) => void;
  /** select exactly these values; `undefined` or every value clears the filter */
  set: (values?: string[]) => void;
  clear: () => void;
  selected: () => string[] | undefined;
  isFiltered: () => boolean;
  /** the function this filter installs on the table, so a count can apply every filter but this one */
  rowFilter: (rowData: any) => boolean;
};

type ChipSelectionArgs = {
  /** every value a chip is offered for */
  values: string[];
  /** the saved selection, as `persist` last received it */
  initial?: string[];
  persist: (selected: string[] | undefined) => void;
  /** after every change, with the new selection (`undefined`: every chip on, no filter) */
  onChange?: (selected?: Set<string>) => void;
};

export type ChipSelection = Omit<ChipFilter, 'rowFilter'>;

/** The chips' selection rules without a table, for a surface that filters its own list (the check-in desk). */
export function createChipSelection({ values, initial, persist, onChange }: ChipSelectionArgs): ChipSelection {
  const normalize = (candidate?: string[]): Set<string> | undefined => {
    const kept = (candidate ?? []).filter((value) => values.includes(value));
    if (!kept.length || kept.length >= values.length) return undefined;
    return new Set(kept);
  };

  let selected = normalize(initial);

  const apply = (next?: Set<string>) => {
    selected = next;
    persist(selected ? [...selected] : undefined);
    onChange?.(selected);
  };

  const toggle = (value: string) => {
    if (!values.includes(value)) return;
    // every chip on: the click picks this one
    if (!selected) return apply(normalize([value]));
    const on = new Set(selected);
    if (on.has(value)) on.delete(value);
    else on.add(value);
    apply(normalize([...on]));
  };

  return {
    isOn: (value: string) => !selected || selected.has(value),
    toggle,
    set: (next?: string[]) => apply(normalize(next)),
    clear: () => apply(undefined),
    selected: () => (selected ? [...selected] : undefined),
    isFiltered: () => !!selected,
  };
}

export function createChipFilter({ table, values, matches, initial, persist, onChange }: ChipFilterArgs): ChipFilter {
  let active: Set<string> | undefined;
  // Tabulator warns when removeFilter is handed a filter it never added
  let applied = false;
  const rowFilter = (rowData: any): boolean => !active || [...active].some((value) => matches(rowData, value));

  const selection = createChipSelection({
    values,
    initial,
    persist,
    onChange: (next) => {
      if (applied) {
        table.removeFilter(rowFilter);
        applied = false;
      }
      active = next;
      if (active) {
        table.addFilter(rowFilter);
        applied = true;
      }
      onChange?.();
    },
  });

  const saved = selection.selected();
  if (saved) {
    active = new Set(saved);
    applied = true;
    whenTableBuilt(table, () => applied && table.addFilter(rowFilter));
  }

  return { ...selection, rowFilter };
}

const CHIP_ROW_WIDTH = 280;
const CHIP_GAP = 6;
const CHIP_PADDING = 22;
const CHAR_WIDTH = 7;

/**
 * Whether chips for these labels fit in `maxRows` rows of the popover's chip width, estimated from the labels.
 * A filter whose chips do not fit keeps its dropdown, so the popover never grows wide or tall for a long list
 * (dates, a tournament's events).
 */
export function chipsFit(labels: string[], { maxRows = 2, rowWidth = CHIP_ROW_WIDTH } = {}): boolean {
  let rows = 1;
  let used = 0;
  for (const label of labels) {
    const width = label.length * CHAR_WIDTH + CHIP_PADDING;
    if (width > rowWidth) return false;
    const needed = used ? used + CHIP_GAP + width : width;
    if (needed <= rowWidth) {
      used = needed;
      continue;
    }
    rows += 1;
    used = width;
    if (rows > maxRows) return false;
  }
  return true;
}

/** A filter with few enough values gets chips; CA 2026-11-08: events and flights only "if there were < 3". */
export const MAX_CHOICE_CHIPS = 2;

type ChoiceItem = { value: string; label: string };

/**
 * One filter, two faces: chips when it has at most MAX_CHOICE_CHIPS values (and they fit the popover), otherwise
 * a dropdown whose options select one value. Both read and write the same chip filter, so a value chosen in one
 * shows in the other. Labels are plain text: the popover writes them with textContent, never as HTML.
 */
export function createChoiceFilter({
  table,
  items,
  allLabel,
  matches,
  initial,
  persist,
}: {
  table: any;
  items: ChoiceItem[];
  allLabel: string;
  matches: (rowData: any, value: string) => boolean;
  initial?: string[];
  persist: (selected: string[] | undefined) => void;
}): {
  chips?: ChipSection;
  options: any[];
  hasOptions: boolean;
  isFiltered: () => boolean;
  activeIndex: () => number;
} {
  const filter = createChipFilter({ table, values: items.map(({ value }) => value), matches, initial, persist });

  const options = [
    { label: allLabel, onClick: () => filter.clear(), close: true },
    { divider: true },
    ...items.map(({ value, label }) => ({
      label,
      filterValue: value,
      onClick: () => filter.set([value]),
      close: true,
    })),
  ];
  const activeIndex = () => {
    const selected = filter.selected();
    if (selected?.length !== 1) return 0;
    return Math.max(items.findIndex(({ value }) => value === selected[0]) + 1, 0);
  };

  return {
    chips:
      items.length <= MAX_CHOICE_CHIPS
        ? { options: items, isOn: filter.isOn, toggle: filter.toggle, clear: filter.clear }
        : undefined,
    options,
    hasOptions: items.length > 1,
    isFiltered: filter.isFiltered,
    activeIndex,
  };
}

/** A chip's own colour, as custom properties its stylesheet reads: the bars' colour for the bucket it filters. */
export function paintChipColor(chip: HTMLElement, { color, ink }: { color?: string; ink?: string }): void {
  if (color) chip.style.setProperty('--chip-color', color);
  if (ink) chip.style.setProperty('--chip-ink', ink);
}
