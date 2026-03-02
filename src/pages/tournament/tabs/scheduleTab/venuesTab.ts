/**
 * Render venue tab with venues table, temporal grid, and control bar.
 * Manages view toggle between venues table and temporal grid.
 */
import { createVenuesTable } from 'components/tables/venuesTable/createVenuesTable';
import { renderTemporalGrid } from '../venuesTab/renderTemporalGrid';
import { venueControl } from '../venuesTab/venueControl';
import { mapVenue } from '../venuesTab/mapVenue';

import { TEMPORAL_GRID_CONTAINER, TOURNAMENT_VENUES, VENUES_CONTROL, NONE } from 'constants/tmxConstants';

import type { TemporalGridInstance } from '../venuesTab/renderTemporalGrid';

export function renderVenueTab(): void {
  const controlAnchor = document.getElementById(VENUES_CONTROL) || undefined;
  const tableContainer = document.getElementById(TOURNAMENT_VENUES);
  const gridContainer = document.getElementById(TEMPORAL_GRID_CONTAINER);

  const { table } = createVenuesTable();

  const updateVenueRow = ({ venue }: { venue: any }) => {
    table.updateOrAddData([mapVenue(venue)]);
  };

  let gridView = false;
  let gridInstance: TemporalGridInstance | null = null;

  const toggleView = () => {
    gridView = !gridView;

    if (tableContainer) tableContainer.style.display = gridView ? NONE : '';
    if (gridContainer) gridContainer.style.display = gridView ? '' : NONE;

    controls?.setGridView(gridView);

    if (gridView && !gridInstance && gridContainer) {
      // Defer grid creation to next frame so the container has layout dimensions
      requestAnimationFrame(() => {
        if (!gridInstance && gridContainer) {
          gridInstance = renderTemporalGrid(gridContainer);
        }
      });
    }
  };

  const saveGrid = () => {
    gridInstance?.save();
  };

  const controls = venueControl({
    table,
    controlAnchor,
    updateVenueRow,
    onToggleView: toggleView,
    onSaveGrid: saveGrid,
  });
}
