/**
 * The title group of a table's tab header: "<label> (<count>)" with "Selected: <n>" beside it.
 *
 * The selected count sits in the header rather than the control bar because the control bar is where a
 * selection's actions appear, and with rows selected it is already full. The header reports table state
 * (the count already follows the filters), and the count is always rendered — muted at zero — so the
 * header does not shift when the first row is ticked.
 */
import { t } from 'i18n';

import './tabHeaderTitle.css';

export interface TabHeaderTitle {
  element: HTMLElement;
  setCount: (count: number) => void;
  setSelected: (selected: number) => void;
}

export function createTabHeaderTitle({
  label,
  count = 0,
  selected,
}: {
  label: string;
  count?: number;
  /** Omit for a view with no row selection (e.g. a card grid): no selected count is rendered. */
  selected?: number;
}): TabHeaderTitle {
  const element = document.createElement('span');
  element.className = 'tabHeader__titleGroup';

  const title = document.createElement('span');
  element.appendChild(title);

  const selectedCount = document.createElement('span');
  selectedCount.className = 'tabHeader__selected';

  const setCount = (n: number) => (title.textContent = `${label} (${n})`);
  const setSelected = (n: number) => {
    if (selectedCount.parentNode !== element) element.appendChild(selectedCount);
    selectedCount.textContent = t('ui.selectedCount', { count: n });
    selectedCount.dataset.selected = String(n);
    selectedCount.classList.toggle('is-active', n > 0);
  };

  setCount(count);
  if (selected !== undefined) setSelected(selected);
  return { element, setCount, setSelected };
}

/** Keep a header's selected count in step with a Tabulator table's row selection. */
export function trackSelectedRows(table: any, title: TabHeaderTitle): void {
  title.setSelected(table?.getSelectedData?.().length ?? 0);
  table?.on?.('rowSelectionChanged', (data: any[]) => title.setSelected(data?.length ?? 0));
}
