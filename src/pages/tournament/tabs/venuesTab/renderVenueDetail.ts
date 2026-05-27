/**
 * Venue detail page — renders venue info banner + court cards grid into the
 * venues tab anchor. Triggered by `/tournament/:id/venue/:venueId` route.
 */

import {
  buildCourtCard,
  buildVenueCard,
  mapCourtToCardData,
  mapVenueToCardData,
  resolveCourtSport
} from 'courthive-components';
import { tournamentEngine } from 'services/factory/engine';
import { editCourt } from './editCourt';
import { editVenue } from './editVenue';
import { context } from 'services/context';
import { t } from 'i18n';

import { TOURNAMENT, VENUES_TAB } from 'constants/tmxConstants';
import './venueDetail.css';

interface Params {
  anchor: HTMLElement;
  venueId: string;
  refreshHeader: (count: number) => void;
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

function buildBackButton(): HTMLElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tmx-venue-detail__back';
  btn.innerHTML = `<i class="fa fa-arrow-left" aria-hidden="true"></i> ${t('pages.venues.title')}`;
  btn.addEventListener('click', () => {
    const tournamentId = tournamentEngine.q.tournament()?.tournamentId;
    if (tournamentId) context.router?.navigate(`/${TOURNAMENT}/${tournamentId}/${VENUES_TAB}`);
  });
  return btn;
}

function buildHeader(venueCardEl: HTMLElement): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'tmx-venue-detail__header';
  wrap.appendChild(buildBackButton());
  wrap.appendChild(venueCardEl);
  return wrap;
}

function buildCourtsSection(courts: any[], sport: any, onCourtClick: (id: string) => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'tmx-venue-detail__courts';

  const heading = document.createElement('h3');
  heading.className = 'tmx-venue-detail__courts-heading';
  heading.textContent = `Courts (${courts.length})`;
  wrap.appendChild(heading);

  if (courts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'tmx-venue-detail__empty';
    empty.textContent = 'No courts at this venue yet.';
    wrap.appendChild(empty);
    return wrap;
  }

  const grid = document.createElement('div');
  grid.className = 'tmx-venue-detail__court-grid';
  for (const court of courts) {
    const card = buildCourtCard(mapCourtToCardData(court, { sport }), undefined, {
      onClick: (data) => onCourtClick(data.courtId)
    });
    grid.appendChild(card);
  }
  wrap.appendChild(grid);
  return wrap;
}

export function renderVenueDetail({ anchor, venueId, refreshHeader }: Params): void {
  const { tournamentRecord } = tournamentEngine.getTournament();
  const venue = tournamentRecord?.venues?.find((v: any) => v.venueId === venueId);

  clearAnchor(anchor);

  if (!venue) {
    refreshHeader(0);
    const empty = document.createElement('div');
    empty.className = 'tmx-venue-detail__empty';
    empty.textContent = 'Venue not found.';
    anchor.appendChild(empty);
    return;
  }

  const sport = resolveTournamentSport();
  const venueData = mapVenueToCardData(venue, { sport });

  refreshHeader(venue.courts?.length ?? 0);

  const wrap = document.createElement('div');
  wrap.className = 'tmx-venue-detail';

  const venueCardEl = buildVenueCard(venueData, undefined, {
    onClick: () => editVenue({ venue, callback: () => renderVenueDetail({ anchor, venueId, refreshHeader }) })
  });

  wrap.appendChild(buildHeader(venueCardEl));

  const onCourtClick = (courtId: string) => {
    const court = venue.courts?.find((c: any) => c.courtId === courtId);
    if (!court) return;
    editCourt({
      court,
      callback: () => renderVenueDetail({ anchor, venueId, refreshHeader })
    });
  };

  wrap.appendChild(buildCourtsSection(venue.courts ?? [], sport, onCourtClick));

  anchor.appendChild(wrap);
}
