/**
 * Card grid renderer for the tournaments page.
 *
 * Renders a responsive CSS grid of `buildTournamentCard` elements into the
 * provided anchor. Supports a skeleton state during async fetch.
 */

import { buildSkeletonCard, buildTournamentCard } from 'courthive-components';
import { tournamentEngine } from 'services/factory/engine';
import { TournamentRow } from './mapTournamentRecord';
import { context } from 'services/context';

import { TOURNAMENT } from 'constants/tmxConstants';

import './tournamentsGrid.css';

const GRID_CLASS = 'tmx-tournaments-grid';
const WRAP_CLASS = 'tmx-tournaments-grid-wrap';
const EMPTY_CLASS = 'tmx-tournaments-empty';
const SKELETON_MODIFIER = 'tmx-tournaments-grid--skeleton';
const DEFAULT_SKELETON_COUNT = 6;

function openTournament(tournamentId: string): void {
  if (!tournamentId) return;
  tournamentEngine.reset();
  context.router?.navigate(`/${TOURNAMENT}/${tournamentId}`);
}

function clearAnchor(anchor: HTMLElement): void {
  while (anchor.firstChild) anchor.removeChild(anchor.firstChild);
  // Strip residue from a prior Tabulator render so the grid view starts
  // from a clean host element.
  anchor.classList.remove('tabulator');
  anchor.removeAttribute('role');
  anchor.removeAttribute('aria-owns');
  anchor.removeAttribute('tabulator-layout');
  anchor.style.removeProperty('height');
}

function buildEmpty(message: string): HTMLElement {
  const empty = document.createElement('div');
  empty.className = EMPTY_CLASS;
  empty.textContent = message;
  return empty;
}

function buildGridContainer(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = WRAP_CLASS;
  const grid = document.createElement('div');
  grid.className = GRID_CLASS;
  wrap.appendChild(grid);
  return wrap;
}

export function renderTournamentsSkeleton(anchor: HTMLElement, count = DEFAULT_SKELETON_COUNT): void {
  clearAnchor(anchor);
  const wrap = buildGridContainer();
  const grid = wrap.firstElementChild as HTMLElement;
  grid.classList.add(SKELETON_MODIFIER);
  for (let i = 0; i < count; i++) grid.appendChild(buildSkeletonCard());
  anchor.appendChild(wrap);
}

export function renderTournamentsGrid(anchor: HTMLElement, rows: TournamentRow[], emptyMessage: string): void {
  clearAnchor(anchor);

  if (rows.length === 0) {
    anchor.appendChild(buildEmpty(emptyMessage));
    return;
  }

  const wrap = buildGridContainer();
  const grid = wrap.firstElementChild as HTMLElement;
  for (const row of rows) {
    grid.appendChild(
      buildTournamentCard(row.tournament, undefined, {
        onClick: (data) => openTournament(data.tournamentId)
      })
    );
  }
  anchor.appendChild(wrap);
}
