/**
 * Render venue tab with venues table, control bar, and temporal grid toggle.
 */
import { renderTemporalGrid, TemporalGridInstance } from '../venuesTab/renderTemporalGrid';
import { createVenuesTable } from 'components/tables/venuesTable/createVenuesTable';
import { showCourtAvailabilityModal } from 'courthive-components';
import { tournamentEngine } from 'tods-competition-factory';
import { venueControl } from '../venuesTab/venueControl';
import { mapVenue } from '../venuesTab/mapVenue';
import { context } from 'services/context';
import { t, i18next } from 'i18n';

import {
  TEMPORAL_GRID_CONTAINER,
  TOURNAMENT,
  TOURNAMENT_VENUES,
  VENUES_CONTROL,
  VENUES_TAB,
} from 'constants/tmxConstants';

const NONE = 'none';
const AVAILABILITY = 'availability';

export function renderVenueTab({ venueView }: { venueView?: string } = {}): void {
  const controlAnchor = document.getElementById(VENUES_CONTROL) || undefined;
  const venuesTableEl = document.getElementById(TOURNAMENT_VENUES);
  const gridContainerEl = document.getElementById(TEMPORAL_GRID_CONTAINER);

  // Clean up any stale grid from a previous tab visit
  if (gridContainerEl) {
    gridContainerEl.innerHTML = '';
    gridContainerEl.style.display = NONE;
  }
  if (venuesTableEl) venuesTableEl.style.display = '';

  const { table } = createVenuesTable();

  const updateVenueRow = ({ venue }: { venue: any }) => {
    table.updateOrAddData([mapVenue(venue)]);
  };

  let gridInstance: TemporalGridInstance | undefined;
  let gridVisible = venueView === AVAILABILITY;

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

  const onSaveToTournament = () => {
    if (!gridInstance) return;
    gridInstance.save();
  };

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

  const showGrid = () => {
    if (venuesTableEl) venuesTableEl.style.display = NONE;
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

  const showTable = () => {
    if (gridInstance) {
      gridInstance.destroy();
      gridInstance = undefined;
    }
    if (gridContainerEl) gridContainerEl.style.display = NONE;
    if (venuesTableEl) venuesTableEl.style.display = '';
  };

  const onToggleGrid = () => {
    gridVisible = !gridVisible;
    if (gridVisible) {
      showGrid();
    } else {
      showTable();
    }

    const btn = elements.viewAvailability;
    if (btn) {
      btn.textContent = gridVisible ? t('pages.venues.viewTable') : t('pages.venues.viewAvailability');
    }

    // Update URL to reflect current view so refresh preserves state
    const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;
    if (tournamentId) {
      const route = gridVisible
        ? `/${TOURNAMENT}/${tournamentId}/${VENUES_TAB}/${AVAILABILITY}`
        : `/${TOURNAMENT}/${tournamentId}/${VENUES_TAB}`;
      context.router?.navigate(route);
    }
  };

  const { elements } = venueControl({
    table,
    controlAnchor,
    updateVenueRow,
    onToggleGrid,
  });

  // If routed to availability view, show grid immediately
  if (gridVisible) {
    showGrid();
    const btn = elements.viewAvailability;
    if (btn) btn.textContent = t('pages.venues.viewTable');
  }
}
