/**
 * Tournaments page — row-1 banner header.
 *
 * Layout (grid, 1fr | auto | 1fr):
 *   [ Tournaments (N) ]          [ All | Upcoming | Live | Completed ]          [ Cards | Table ]
 *
 * Reflects the schedule-page panel style (rounded top, panel bg, subtle
 * shadow) for cross-page visual consistency.
 */

import { TournamentsView } from 'components/tables/tournamentsTable/createTournamentsTable';
import { buildViewToggleElement } from 'components/tables/common/viewToggle';
import { TournamentsStatusFilter } from './tournamentsViewState';

import './tournamentsHeader.css';
import { t } from 'i18n';

interface StatusChip {
  value: TournamentsStatusFilter;
  label: string;
}

const statusChips = (): StatusChip[] => [
  { value: 'all', label: t('tournamentsControls.all') },
  { value: 'upcoming', label: t('tournamentsControls.upcoming') },
  { value: 'live', label: t('pages.matchUps.live') },
  { value: 'completed', label: t('draws.completed') },
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

  for (const chip of statusChips()) {
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
      onChange: (m) => view.setViewMode(m),
    }),
  );

  return {
    element: banner,
    setCount: (count: number) => {
      title.textContent = `Tournaments (${count})`;
    },
  };
}
