import { mutationRequest } from 'services/mutation/mutationRequest';
import { getLatLong } from 'components/modals/getLatLong';

import { MODIFY_VENUE } from 'constants/mutationConstants';

export function setLatLong(e, cell) {
  const rowData = cell.getRow().getData();
  const { latitude, longitude } = rowData?.address || {};
  const callback = (value = {}) => {
    if (!rowData.address) rowData.address = {};
    const venue = rowData.venue;
    if (!venue.addresses) venue.addresses = [];
    if (!venue.addresses.length) {
      venue.addresses.push({ latitude: value.latitude, longitude: value.longitude });
    } else {
      Object.assign(venue.addresses[0], { latitude: value.latitude, longitude: value.longitude });
    }

    const postMutation = (result) => {
      if (result.results?.[0]?.success) {
        const table = cell.getTable();
        rowData.address.latitude = value.latitude;
        rowData.address.longitude = value.longitude;
        rowData.hasLocation = value.latitude && value.longitude;
        table.updateData([rowData]);
      }
    };

    const methods = [
      {
        method: MODIFY_VENUE,
        params: {
          venueId: rowData.venueId,
          modifications: venue
        }
      }
    ];
    mutationRequest({ methods, callback: postMutation });
  };

  getLatLong({ coords: { latitude, longitude }, callback });
}
