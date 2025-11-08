import { createVenuesTable } from 'components/tables/venuesTable/createVenuesTable';
import { venueControl } from '../venuesTab/venueControl';
import { mapVenue } from '../venuesTab/mapVenue';

import { VENUES_CONTROL } from 'constants/tmxConstants';

export function renderVenueTab(): void {
  const controlAnchor = document.getElementById(VENUES_CONTROL);

  const { table } = createVenuesTable();

  const updateVenueRow = ({ venue }: { venue: any }) => {
    table.updateOrAddData([mapVenue(venue)]);
  };

  venueControl({ table, controlAnchor, updateVenueRow });
}
