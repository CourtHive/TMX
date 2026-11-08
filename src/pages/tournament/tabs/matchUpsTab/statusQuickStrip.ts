/**
 * The matchUps table's footer: the status chips with counts, one click from the table (CA 2026-11-08). The same
 * chips as the filter popover's Status section, on the same filter, so the two never disagree.
 *
 * A chip's count is the rows it would show: every other filter applied, the status chips themselves not. So
 * "To be played 37" with Doubles off in the Type chips is 37 singles still to play, whichever status chips are on.
 */
import { STATUS_BUCKETS, statusBucketOf } from 'components/tables/common/filters/matchUpStatusPredicates';
import type { ChipFilter, ChipSection } from 'components/tables/common/filters/chipFilter';
import { paintChipColor } from 'components/tables/common/filters/chipFilter';
import { t } from 'i18n';

type StripArgs = {
  table: any;
  element: HTMLElement;
  chips: ChipSection;
  bucketFilter: ChipFilter;
  /** after a chip here changes the filter: the popover's badge */
  onToggle: () => void;
};

/** The rows every filter but `excluded` lets through. The matchUps table's filters are all functions. */
export function rowsPassingOthers(table: any, excluded: (rowData: any) => boolean): any[] {
  const others = (table.getFilters?.() ?? [])
    .map((filter: any) => filter.field)
    .filter((field: any) => typeof field === 'function' && field !== excluded);
  return (table.getData?.() ?? []).filter((rowData: any) => others.every((filter: any) => filter(rowData)));
}

export function bucketCounts(rows: any[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(STATUS_BUCKETS.map((bucket) => [bucket, 0]));
  for (const rowData of rows) counts[statusBucketOf(rowData)] += 1;
  return counts;
}

export function mountStatusQuickStrip({ table, element, chips, bucketFilter, onToggle }: StripArgs): {
  refresh: () => void;
} {
  element.classList.add('tmx-status-strip');
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', t('pages.matchUps.statusStripLabel'));

  const buttons = chips.options.map(({ value, label, color, ink }) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-popover-chip tmx-status-strip-chip font-medium';
    chip.dataset.value = value;
    paintChipColor(chip, { color, ink });
    const name = document.createElement('span');
    name.textContent = label;
    const count = document.createElement('span');
    count.className = 'tmx-status-strip-count';
    chip.append(name, count);
    chip.addEventListener('click', () => {
      chips.toggle(value);
      onToggle();
    });
    return chip;
  });
  element.replaceChildren(...buttons);

  let frame = 0;
  const paint = () => {
    frame = 0;
    // Tabulator warns when getFilters runs before the table is built (journey 115); `tableBuilt` repaints
    if (table.initialized === false) return;
    const counts = bucketCounts(rowsPassingOthers(table, bucketFilter.rowFilter));
    for (const chip of buttons) {
      const value = chip.dataset.value as string;
      const on = chips.isOn(value);
      chip.setAttribute('aria-pressed', String(on));
      chip.dataset.on = String(on);
      (chip.lastElementChild as HTMLElement).textContent = String(counts[value] ?? 0);
    }
  };
  // one paint per frame however many filters change together
  const refresh = () => {
    if (!frame) frame = requestAnimationFrame(paint);
  };

  table.on?.('dataFiltered', refresh);
  table.on?.('tableBuilt', refresh);
  table.on?.('dataProcessed', refresh);
  refresh();
  return { refresh };
}
