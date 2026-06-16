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

/**
 * Sync `is-active` + `aria-pressed` on the toggle's buttons to `next`. The
 * toggle has to update its own DOM rather than wait for the parent to
 * re-render, because some consumers (the global tournaments page) build the
 * header once and only re-render the body — the highlight gets stuck on the
 * initial mode unless we sync here.
 */
function syncActiveState(root: HTMLElement | null, next: Mode): void {
  if (!root) return;
  const buttons = root.querySelectorAll<HTMLElement>('[data-mode]');
  buttons.forEach((btn) => {
    const active = btn.dataset.mode === next;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function resolveModeFromClick(target: EventTarget | null): Mode | null {
  const btn = (target as HTMLElement | null)?.closest('[data-mode]') as HTMLElement | null;
  if (!btn) return null;
  const next = btn.dataset.mode;
  return next === 'grid' || next === 'table' ? next : null;
}

export function viewToggleItem({ id, mode, onChange, location = CENTER }: ViewToggleItemParams): any {
  return {
    id,
    text: buildHTML(mode),
    onClick: (e: any) => {
      const next = resolveModeFromClick(e?.target);
      if (!next) return;
      syncActiveState((e?.target as HTMLElement | null)?.closest('.tmx-view-toggle') as HTMLElement | null, next);
      onChange(next);
    },
    location
  };
}

export function buildViewToggleElement({ mode, onChange }: ViewToggleCommon): HTMLElement {
  const wrap = document.createElement('div');
  wrap.innerHTML = buildHTML(mode).trim();
  const toggle = wrap.firstElementChild as HTMLElement;
  toggle.addEventListener('click', (e) => {
    const next = resolveModeFromClick(e.target);
    if (!next) return;
    syncActiveState(toggle, next);
    onChange(next);
  });
  return toggle;
}
