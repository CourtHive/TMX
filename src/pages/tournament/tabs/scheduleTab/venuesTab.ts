/**
 * Render venue tab with venues table and control bar.
 * Creates venue table and sets up venue row update handler.
 */
import { createVenuesTable } from 'components/tables/venuesTable/createVenuesTable';
import { venueControl } from '../venuesTab/venueControl';
import { mapVenue } from '../venuesTab/mapVenue';

import { VENUES_CONTROL } from 'constants/tmxConstants';

export function renderVenueTab(): void {
  const controlAnchor = document.getElementById(VENUES_CONTROL) || undefined;

  const { table } = createVenuesTable();

  const updateVenueRow = ({ venue }: { venue: any }) => {
    table.updateOrAddData([mapVenue(venue)]);
  };

  venueControl({ table, controlAnchor, updateVenueRow });
}
