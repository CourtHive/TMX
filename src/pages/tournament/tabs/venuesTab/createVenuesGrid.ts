/**
 * Card-grid renderer for the venues tab.
 * Reads venues via the factory, maps each through the shared
 * `mapVenueToCardData`, renders a responsive CSS grid into TOURNAMENT_VENUES.
 * Returns the rendered row count so the orchestrator can update the tab
 * header (which it owns).
 */

import { buildVenueCard, mapVenueToCardData, resolveCourtSport, VenueCardData } from 'courthive-components';
import { tournamentEngine } from 'services/factory/engine';

import './venuesGrid.css';

const GRID_CLASS = 'tmx-venues-grid';
const WRAP_CLASS = 'tmx-venues-grid-wrap';
const EMPTY_CLASS = 'tmx-venues-empty';

function clearAnchor(anchor: HTMLElement): void {
  while (anchor.firstChild) anchor.removeChild(anchor.firstChild);
  anchor.classList.remove('tabulator');
  anchor.removeAttribute('role');
  anchor.removeAttribute('aria-owns');
  anchor.removeAttribute('tabulator-layout');
  anchor.style.removeProperty('height');
}

function resolveTournamentSport(): any {
  const { tournamentRecord } = tournamentEngine.getTournament();
  const firstEvent = tournamentRecord?.events?.[0];
  return resolveCourtSport(firstEvent);
}

export function readVenueCardData(): VenueCardData[] {
  const { tournamentRecord } = tournamentEngine.getTournament();
  const venues = tournamentRecord?.venues ?? [];
  const sport = resolveTournamentSport();
  return venues.map((venue: any) => mapVenueToCardData(venue, { sport }));
}

export function renderVenuesGrid(
  anchor: HTMLElement,
  onCardClick: (venueId: string) => void,
  query?: string
): number {
  clearAnchor(anchor);
  const rows = readVenueCardData();
  const q = query?.toLowerCase();
  const filtered = q
    ? rows.filter(
        (r) =>
          (r.venueName || '').toLowerCase().includes(q) ||
          (r.addressFormatted || '').toLowerCase().includes(q)
      )
    : rows;

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = EMPTY_CLASS;
    empty.textContent = q ? 'No venues match this search.' : 'No venues yet.';
    anchor.appendChild(empty);
    return 0;
  }

  const wrap = document.createElement('div');
  wrap.className = WRAP_CLASS;
  const grid = document.createElement('div');
  grid.className = GRID_CLASS;
  wrap.appendChild(grid);

  for (const row of filtered) {
    grid.appendChild(buildVenueCard(row, undefined, { onClick: (data) => onCardClick(data.venueId) }));
  }

  anchor.appendChild(wrap);
  return filtered.length;
}
