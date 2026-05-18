/**
 * Compact icon-based Cards/Table view toggle.
 *
 * Two exports:
 *   - `viewToggleItem(...)` — returns a `controlBar` item shape, for pages
 *     without a section header (e.g. the global tournaments page).
 *   - `buildViewToggleElement(...)` — returns an HTMLElement, for pages
 *     that want the toggle inline with a tab heading (Events, Venues).
 */

import './viewToggle.css';

import { CENTER } from 'constants/tmxConstants';

type Mode = 'grid' | 'table';

interface ViewToggleCommon {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

interface ViewToggleItemParams extends ViewToggleCommon {
  id: string;
  /** controlBar location key. Defaults to CENTER. */
  location?: string;
}

function buildHTML(mode: Mode): string {
  return `
    <div class="tmx-view-toggle" role="group" aria-label="Switch view">
      <button type="button" data-mode="grid" class="tmx-view-toggle__btn${mode === 'grid' ? ' is-active' : ''}" aria-label="Cards view" aria-pressed="${mode === 'grid'}">
        <i class="fa fa-th-large" aria-hidden="true"></i>
      </button>
      <button type="button" data-mode="table" class="tmx-view-toggle__btn${mode === 'table' ? ' is-active' : ''}" aria-label="Table view" aria-pressed="${mode === 'table'}">
        <i class="fa fa-list" aria-hidden="true"></i>
      </button>
    </div>
  `;
}

export function viewToggleItem({ id, mode, onChange, location = CENTER }: ViewToggleItemParams): any {
  return {
    id,
    text: buildHTML(mode),
    onClick: (e: any) => {
      const btn = (e?.target as HTMLElement | null)?.closest('[data-mode]') as HTMLElement | null;
      if (!btn) return;
      const next = btn.dataset.mode as Mode;
      if (next === 'grid' || next === 'table') onChange(next);
    },
    location
  };
}

export function buildViewToggleElement({ mode, onChange }: ViewToggleCommon): HTMLElement {
  const wrap = document.createElement('div');
  wrap.innerHTML = buildHTML(mode).trim();
  const toggle = wrap.firstElementChild as HTMLElement;
  toggle.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement | null)?.closest('[data-mode]') as HTMLElement | null;
    if (!btn) return;
    const next = btn.dataset.mode as Mode;
    if (next === 'grid' || next === 'table') onChange(next);
  });
  return toggle;
}
