/**
 * Venue control bar with add, delete, view toggle, and save actions.
 * Manages venue operations from the venues table and temporal grid.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { controlBar } from 'courthive-components';
import { addVenue } from './addVenue';
import { t } from 'i18n';

import { DELETE_VENUES } from 'constants/mutationConstants';
import { NONE, OVERLAY, RIGHT } from 'constants/tmxConstants';

type VenueControlParams = {
  table: any;
  updateVenueRow: (params: any) => void;
  controlAnchor?: HTMLElement;
  onToggleView?: () => void;
  onSaveGrid?: () => void;
};

export function venueControl({
  table,
  updateVenueRow,
  controlAnchor,
  onToggleView,
  onSaveGrid,
}: VenueControlParams = {} as any): any {
  if (!controlAnchor) return;

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
    },
    {
      onClick: onToggleView,
      label: t('view'),
      location: RIGHT,
      id: 'toggleTemporalGrid',
      intent: 'is-info',
    },
    {
      onClick: onSaveGrid,
      label: t('save'),
      location: RIGHT,
      id: 'saveTemporalGrid',
      intent: 'is-success',
      visible: false,
    },
    {
      label: t('pages.venues.addVenue.title'),
      onClick: () => addVenue(updateVenueRow),
      location: RIGHT,
      id: 'addVenue',
      intent: 'none',
    },
  ];

  const result = controlBar({ table, target: controlAnchor, items });

  return {
    elements: result?.elements,
    setGridView: (isGridView: boolean) => {
      const toggleBtn = result?.elements?.toggleTemporalGrid;
      const saveBtn = result?.elements?.saveTemporalGrid;
      const addBtn = result?.elements?.addVenue;
      if (toggleBtn) toggleBtn.innerHTML = isGridView ? t('ccl') : t('view');
      if (saveBtn) saveBtn.style.display = isGridView ? '' : NONE;
      if (addBtn) addBtn.style.display = isGridView ? NONE : '';
    },
  };
}
