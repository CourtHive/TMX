/**
 * Card-grid renderer for the events tab.
 *
 * Mirrors the tournaments-page grid pattern: reads events via the factory,
 * maps each through the shared `mapEventToCardData`, renders a responsive
 * CSS grid of `buildEventCard` elements into the existing TOURNAMENT_EVENTS
 * anchor. Honours the same `lightMode` threshold (15) as the table view so
 * mapping cost matches at scale.
 */

import {
  buildEventCard,
  EVENT_CARD_LIGHT_MODE_THRESHOLD,
  EventCardData,
  mapEventToCardData,
  resolveCourtSport
} from 'courthive-components';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { tournamentEngine } from 'services/factory/engine';

import './eventsGrid.css';

const GRID_CLASS = 'tmx-events-grid';
const WRAP_CLASS = 'tmx-events-grid-wrap';
const EMPTY_CLASS = 'tmx-events-empty';

function openEvent(eventId: string): void {
  if (!eventId) return;
  // Mirror the events table's row-click behaviour: single draw opens that
  // draw, multiple draws opens the draws list, no draws falls through to
  // the event's entries tab.
  const { event } = tournamentEngine.getEvent({ eventId });
  const drawDefs = event?.drawDefinitions || [];
  if (drawDefs.length === 1) {
    navigateToEvent({ eventId, drawId: drawDefs[0].drawId, renderDraw: true });
  } else if (drawDefs.length > 1) {
    navigateToEvent({ eventId, renderDraw: true });
  } else {
    navigateToEvent({ eventId });
  }
}

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

export function readEventCardData(): EventCardData[] {
  const { tournamentRecord } = tournamentEngine.getTournament();
  const events = tournamentRecord?.events ?? [];
  const lightMode = events.length > EVENT_CARD_LIGHT_MODE_THRESHOLD;
  const sport = resolveTournamentSport();
  return events.map((event: any) => mapEventToCardData(event, { lightMode, sport }));
}

export function renderEventsGrid(anchor: HTMLElement, query?: string): number {
  clearAnchor(anchor);
  const rows = readEventCardData();

  const filtered = query
    ? rows.filter(
        (r) =>
          (r.eventName || '').toLowerCase().includes(query) ||
          (r.categoryLabel || '').toLowerCase().includes(query)
      )
    : rows;

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = EMPTY_CLASS;
    empty.textContent = query ? 'No events match this search.' : 'No events yet.';
    anchor.appendChild(empty);
    return 0;
  }

  const wrap = document.createElement('div');
  wrap.className = WRAP_CLASS;
  const grid = document.createElement('div');
  grid.className = GRID_CLASS;
  wrap.appendChild(grid);

  for (const row of filtered) {
    grid.appendChild(
      buildEventCard(row, undefined, {
        onClick: (data) => openEvent(data.eventId)
      })
    );
  }

  anchor.appendChild(wrap);
  return filtered.length;
}
