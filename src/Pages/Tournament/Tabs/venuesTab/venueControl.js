import { mutationRequest } from 'services/mutation/mutationRequest';
import { controlBar } from 'components/controlBar/controlBar';
import { addVenue } from './addVenue';

import { DELETE_VENUES } from 'constants/mutationConstants';
import { OVERLAY, RIGHT } from 'constants/tmxConstants';

export function venueControl({ table, updateVenueRow, controlAnchor } = {}) {
  if (!controlAnchor) return;

  const deleteVenues = () => {
    const venueIds = table.getSelectedData().map(({ venueId }) => venueId);
    const methods = [{ method: DELETE_VENUES, params: { venueIds, force: true } }];
    const callback = (result) => result.success && table.deleteRow(venueIds);
    mutationRequest({ methods, callback });
  };

  const items = [
    {
      onClick: deleteVenues,
      label: 'Delete selected',
      intent: 'is-danger',
      stateChange: true,
      location: OVERLAY
    },
    {
      label: 'Add venue',
      onClick: () => addVenue(updateVenueRow),
      location: RIGHT,
      id: 'addVenue',
      intent: 'none'
    }
  ];

  return controlBar({ table, target: controlAnchor, items }).elements;
}
