/**
 * Venue control bar with add, delete, and grid toggle buttons.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { providerConfig } from 'config/providerConfig';
import { controlBar } from 'courthive-components';
import { addVenue } from './addVenue';
import { t } from 'i18n';

import { DELETE_VENUES } from 'constants/mutationConstants';
import { OVERLAY, RIGHT } from 'constants/tmxConstants';

type VenueControlParams = {
  table: any;
  updateVenueRow: (params: any) => void;
  onToggleGrid?: () => void;
  controlAnchor?: HTMLElement;
};

export function venueControl({
  table,
  updateVenueRow,
  onToggleGrid,
  controlAnchor,
}: VenueControlParams = {} as any): { elements: Record<string, HTMLElement> } {
  if (!controlAnchor) return { elements: {} };

  const deleteVenues = () => {
    const venueIds = table.getSelectedData().map(({ venueId }: any) => venueId);
    const methods = [{ method: DELETE_VENUES, params: { venueIds, force: true } }];
    const callback = (result: any) => result.success && table.deleteRow(venueIds);
    mutationRequest({ methods, callback });
  };

  const items = [
    {
      onClick: deleteVenues,
      label: t('pages.events.deleteSelected'),
      intent: 'is-danger',
      stateChange: true,
      location: OVERLAY,
      hide: !providerConfig.isAllowed('canDeleteVenues'),
    },
    {
      label: t('pages.venues.addVenue.title'),
      onClick: () => addVenue(updateVenueRow),
      location: RIGHT,
      id: 'addVenue',
      intent: 'none',
      hide: !providerConfig.isAllowed('canCreateVenues'),
    },
    {
      label: t('pages.venues.viewAvailability'),
      onClick: onToggleGrid,
      location: RIGHT,
      id: 'viewAvailability',
      intent: 'is-info',
    },
  ];

  const { elements } = controlBar({ table, target: controlAnchor, items });

  return { elements };
}
