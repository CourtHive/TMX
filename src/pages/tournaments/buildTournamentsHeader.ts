/**
 * Tournaments page — row-1 banner header.
 *
 * Layout (grid, 1fr | auto | 1fr):
 *   [ Tournaments (N) ]          [ All | Upcoming | Live | Completed ]          [ Cards | Table ]
 *
 * Reflects the schedule-page panel style (rounded top, panel bg, subtle
 * shadow) for cross-page visual consistency.
 */

import { buildViewToggleElement } from 'components/tables/common/viewToggle';
import { TournamentsStatusFilter } from './tournamentsViewState';
import { TournamentsView } from 'components/tables/tournamentsTable/createTournamentsTable';

import './tournamentsHeader.css';

interface StatusChip {
  value: TournamentsStatusFilter;
  label: string;
}

const STATUS_CHIPS: StatusChip[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'live', label: 'Live' },
  { value: 'completed', label: 'Completed' }
];

interface BuildHeaderParams {
  view: TournamentsView;
  initialCount: number;
}

interface HeaderHandle {
  element: HTMLElement;
  setCount: (count: number) => void;
}

function buildTitle(count: number): HTMLElement {
  const title = document.createElement('span');
  title.className = 'tmx-tournaments-header__title';
  title.textContent = `Tournaments (${count})`;
  return title;
}

function buildChips(view: TournamentsView): HTMLElement {
  const current = view.getState().statusFilter;

  const wrap = document.createElement('div');
  wrap.className = 'tabs is-toggle is-toggle-rounded tmx-tournaments-header__chips';

  const ul = document.createElement('ul');
  wrap.appendChild(ul);

  for (const chip of STATUS_CHIPS) {
    const li = document.createElement('li');
    if (chip.value === current) li.classList.add('is-active');

    const a = document.createElement('a');
    a.onclick = (e) => {
      e.stopPropagation();
      ul.querySelectorAll('li').forEach((el) => el.classList.remove('is-active'));
      li.classList.add('is-active');
      view.setStatusFilter(chip.value);
    };
    const span = document.createElement('span');
    span.textContent = chip.label;
    a.appendChild(span);
    li.appendChild(a);
    ul.appendChild(li);
  }
  return wrap;
}

export function buildTournamentsHeader({ view, initialCount }: BuildHeaderParams): HeaderHandle {
  const banner = document.createElement('div');
  banner.className = 'tabHeader tabHeader--banner tmx-tournaments-header';

  const title = buildTitle(initialCount);
  banner.appendChild(title);

  banner.appendChild(buildChips(view));

  banner.appendChild(
    buildViewToggleElement({
      mode: view.getState().viewMode,
      onChange: (m) => view.setViewMode(m)
    })
  );

  return {
    element: banner,
    setCount: (count: number) => {
      title.textContent = `Tournaments (${count})`;
    }
  };
}
