/**
 * Render venue tab — cards (default) / table / availability / single-venue detail.
 *
 * View modes:
 *   - 'grid'  — venue cards (default)
 *   - 'table' — Tabulator (dense)
 *
 * Routes:
 *   /tournament/:id/venues                  — list view (cards or table per localStorage)
 *   /tournament/:id/venues/availability     — temporal grid (URL-driven)
 *   /tournament/:id/venue/:venueId          — single-venue detail (banner + court cards)
 */

import { renderTemporalGrid, TemporalGridInstance } from './renderTemporalGrid';
import { readVenuesViewMode, VenuesViewMode, writeVenuesViewMode } from './venuesViewMode';
import { createVenuesTable } from 'components/tables/venuesTable/createVenuesTable';
import { renderVenuesGrid, readVenueCardData } from './createVenuesGrid';
import { showCourtAvailabilityModal } from 'courthive-components';
import { buildViewToggleElement } from 'components/tables/common/viewToggle';
import { tournamentEngine } from 'services/factory/engine';
import { renderVenueDetail } from './renderVenueDetail';
import { setTabHeader } from 'components/tables/common/setTabHeader';
import { destroyTable } from 'pages/tournament/destroyTable';
import { venueControl } from './venueControl';
import { context } from 'services/context';
import { t, i18next } from 'i18n';

import {
  TEMPORAL_GRID_CONTAINER,
  TOURNAMENT,
  TOURNAMENT_VENUES,
  VENUE,
  VENUES_CONTROL,
  VENUES_TAB,
} from 'constants/tmxConstants';

const NONE = 'none';
const AVAILABILITY = 'availability';

interface RenderVenueTabParams {
  venueView?: string;
  venueId?: string;
}

export function renderVenueTab({ venueView, venueId }: RenderVenueTabParams = {}): void {
  const controlAnchor = document.getElementById(VENUES_CONTROL) || undefined;
  const venuesAnchor = document.getElementById(TOURNAMENT_VENUES);
  const gridContainerEl = document.getElementById(TEMPORAL_GRID_CONTAINER);

  if (gridContainerEl) {
    gridContainerEl.innerHTML = '';
    gridContainerEl.style.display = NONE;
  }
  if (venuesAnchor) venuesAnchor.style.display = '';

  // ─── Detail view (single venue) takes precedence ────────────────────────
  if (venueId && venuesAnchor) {
    const refreshDetailHeader = (courtCount: number) => {
      const venue = tournamentEngine
        .getTournament()
        ?.tournamentRecord?.venues?.find((v: any) => v.venueId === venueId);
      setTabHeader({
        anchor: venuesAnchor,
        label: venue?.venueName || t('pages.venues.title'),
        count: courtCount
      });
    };
    renderVenueDetail({ anchor: venuesAnchor, venueId, refreshHeader: refreshDetailHeader });
    // No control bar in detail mode — the detail page owns its own back
    // button, and [Add Venue] / [View Availability] aren't scoped to a
    // single venue. Clear any leftovers from a prior list render.
    if (controlAnchor) controlAnchor.innerHTML = '';
    return;
  }

  // ─── List view (cards or table) ─────────────────────────────────────────
  let mode: VenuesViewMode = readVenuesViewMode();
  let table: any;
  let gridInstance: TemporalGridInstance | undefined;
  let availabilityVisible = venueView === AVAILABILITY;

  function buildToggle(): HTMLElement {
    return buildViewToggleElement({
      mode,
      onChange: (m) => {
        if (m === mode) return;
        mode = m;
        writeVenuesViewMode(m);
        renderForMode();
      }
    });
  }

  function refreshHeader(count: number): void {
    if (!venuesAnchor) return;
    setTabHeader({
      anchor: venuesAnchor,
      label: t('pages.venues.title'),
      count,
      trailing: availabilityVisible ? undefined : buildToggle()
    });
  }

  const onCardClick = (vId: string) => {
    const tournamentId = tournamentEngine.q.tournament()?.tournamentId;
    if (!tournamentId) return;
    context.router?.navigate(`/${TOURNAMENT}/${tournamentId}/${VENUE}/${vId}`);
  };

  const updateVenueRow = () => {
    if (mode === 'table' && table) {
      // Table mode self-updates via dataChanged; orchestrator refreshes header.
      refreshHeader(table.getDataCount?.() ?? table.getData?.().length ?? 0);
    } else if (mode === 'grid' && venuesAnchor) {
      const count = renderVenuesGrid(venuesAnchor, onCardClick);
      refreshHeader(count);
    }
  };

  function renderGrid(): void {
    if (!venuesAnchor) return;
    destroyTable({ anchorId: TOURNAMENT_VENUES });
    table = undefined;
    const count = renderVenuesGrid(venuesAnchor, onCardClick);
    refreshHeader(count);
  }

  function renderTable(): void {
    const result = createVenuesTable();
    table = result.table;
    const initialCount = table?.getDataCount?.() ?? table?.getData?.().length ?? 0;
    refreshHeader(initialCount);
    table?.on?.('dataChanged', (rows: any[]) => refreshHeader(rows.length));
    table?.on?.('dataFiltered', (_filters: any, rows: any[]) => refreshHeader(rows.length));
  }

  function renderForMode(): void {
    if (mode === 'grid') renderGrid();
    else renderTable();
    renderControls();
  }

  const onSetDefaultAvailability = () => {
    if (!gridInstance) return;
    const engine = gridInstance.grid.getEngine();
    const config = engine.getConfig();
    const { tournamentRecord } = tournamentEngine.getTournament();
    const venues = tournamentRecord?.venues ?? [];

    const firstVenue = venues[0];
    const venueAvail = firstVenue ? engine.getVenueAvailability(config.tournamentId, firstVenue.venueId) : null;
    const avail = venueAvail || { startTime: config.dayStartTime, endTime: config.dayEndTime };

    showCourtAvailabilityModal({
      title: t('pages.venues.setDefaultAvailability'),
      currentDay: engine.getActiveDays()[0] || '',
      currentStartTime: avail.startTime,
      currentEndTime: avail.endTime,
      showScopeToggle: false,
      labels: {
        startTime: t('modals.courtAvailability.startTime'),
        endTime: t('modals.courtAvailability.endTime'),
        cancel: t('modals.courtAvailability.cancel'),
        apply: t('modals.courtAvailability.apply'),
      },
      onConfirm: ({ startTime, endTime }) => {
        for (const venue of venues) {
          engine.setVenueDefaultAvailability(config.tournamentId, venue.venueId, { startTime, endTime });
          engine.clearCourtAvailabilityForVenue(config.tournamentId, venue.venueId);
        }
        gridInstance?.grid.refresh();
      },
    });
  };

  const onSaveToTournament = () => gridInstance?.save();

  const gridLabels = {
    view: t('pages.venues.grid.view'),
    day1: t('pages.venues.grid.day1'),
    days3: t('pages.venues.grid.days3'),
    week: t('pages.venues.grid.week'),
    tournament: t('pages.venues.grid.tournament'),
    courtAvailability: t('pages.venues.grid.courtAvailability'),
    totalHours: t('pages.venues.grid.totalHours'),
    blocked: t('pages.venues.grid.blocked'),
    available: t('pages.venues.grid.available'),
    avgPerCourt: t('pages.venues.grid.avgPerCourt'),
    setDefaultAvailability: t('pages.venues.setDefaultAvailability'),
    saveToTournament: t('pages.venues.saveToTournament'),
  };

  const showAvailability = () => {
    if (venuesAnchor) venuesAnchor.style.display = NONE;
    if (gridContainerEl) {
      gridContainerEl.style.display = '';
      if (!gridInstance) {
        gridInstance = renderTemporalGrid(gridContainerEl, {
          labels: gridLabels,
          language: i18next.language,
          onSetDefaultAvailability,
          onSave: onSaveToTournament,
        });
      }
    }
  };

  const showRows = () => {
    if (gridInstance) {
      gridInstance.destroy();
      gridInstance = undefined;
    }
    if (gridContainerEl) gridContainerEl.style.display = NONE;
    if (venuesAnchor) venuesAnchor.style.display = '';
  };

  const onToggleAvailability = () => {
    availabilityVisible = !availabilityVisible;
    if (availabilityVisible) showAvailability();
    else showRows();
    refreshHeader(readVenueCardData().length);
    renderControls();
    const tournamentId = tournamentEngine.q.tournament()?.tournamentId;
    if (tournamentId) {
      const route = availabilityVisible
        ? `/${TOURNAMENT}/${tournamentId}/${VENUES_TAB}/${AVAILABILITY}`
        : `/${TOURNAMENT}/${tournamentId}/${VENUES_TAB}`;
      context.router?.navigate(route);
    }
  };

  function renderControls(): void {
    const { elements: ctrlElements } = venueControl({
      table,
      controlAnchor,
      updateVenueRow,
      onToggleGrid: onToggleAvailability,
    });
    const btn = ctrlElements.viewAvailability;
    if (btn) btn.textContent = availabilityVisible ? t('pages.venues.viewTable') : t('pages.venues.viewAvailability');
  }

  if (!venuesAnchor) return;
  refreshHeader(readVenueCardData().length);
  renderForMode();
  if (availabilityVisible) {
    showAvailability();
    renderControls();
    refreshHeader(readVenueCardData().length);
  }
}
