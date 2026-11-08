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

export type ChipOption = { label: string; value: string };

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
};

export type ChipFilter = {
  isOn: (value: string) => boolean;
  toggle: (value: string) => void;
  /** select exactly these values; `undefined` or every value clears the filter */
  set: (values?: string[]) => void;
  clear: () => void;
  selected: () => string[] | undefined;
  isFiltered: () => boolean;
};

export function createChipFilter({ table, values, matches, initial, persist }: ChipFilterArgs): ChipFilter {
  const normalize = (candidate?: string[]): Set<string> | undefined => {
    const kept = (candidate ?? []).filter((value) => values.includes(value));
    if (!kept.length || kept.length >= values.length) return undefined;
    return new Set(kept);
  };

  let selected = normalize(initial);
  // Tabulator warns when removeFilter is handed a filter it never added
  let applied = false;
  const rowFilter = (rowData: any): boolean => !selected || [...selected].some((value) => matches(rowData, value));

  if (selected) {
    applied = true;
    whenTableBuilt(table, () => applied && table.addFilter(rowFilter));
  }

  const apply = (next?: Set<string>) => {
    if (applied) {
      table.removeFilter(rowFilter);
      applied = false;
    }
    selected = next;
    persist(selected ? [...selected] : undefined);
    if (selected) {
      table.addFilter(rowFilter);
      applied = true;
    }
  };

  const isOn = (value: string) => !selected || selected.has(value);

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
    isOn,
    toggle,
    set: (next?: string[]) => apply(normalize(next)),
    clear: () => apply(undefined),
    selected: () => (selected ? [...selected] : undefined),
    isFiltered: () => !!selected,
  };
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
