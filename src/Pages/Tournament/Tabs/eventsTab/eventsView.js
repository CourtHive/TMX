import { createEventsTable } from 'components/tables/eventsTable/createEventsTable';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { mapEvent } from 'Pages/Tournament/Tabs/eventsTab/mapEvent';
import { controlBar } from 'components/controlBar/controlBar';
import { editEvent } from './editEvent';

import { EVENTS_CONTROL, LEFT, OVERLAY, RIGHT } from 'constants/tmxConstants';
import { DELETE_EVENTS } from 'constants/mutationConstants';

export function eventsView() {
  const { table } = createEventsTable();

  const eventAdded = (result) => {
    if (result?.event) {
      const tableRow = mapEvent(result.event);
      table?.updateOrAddData([tableRow]);
    }
  };

  // SEARCH filter
  let searchText;
  const searchFilter = (rowData) => rowData.searchText?.includes(searchText);
  const updateSearchFilter = (value) => {
    if (!value) table?.removeFilter(searchFilter);
    searchText = value;
    if (value) table?.addFilter(searchFilter);
  };

  const deleteEvents = () => {
    const eventIds = table?.getSelectedData().map(({ eventId }) => eventId);

    const callback = (result) => result.success && table?.deleteRow(eventIds);
    mutationRequest({ methods: [{ method: DELETE_EVENTS, params: { eventIds } }], callback });
  };

  const items = [
    {
      onClick: deleteEvents,
      label: 'Delete selected',
      intent: 'is-danger',
      stateChange: true,
      location: OVERLAY
    },
    {
      onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateSearchFilter(''),
      onChange: (e) => updateSearchFilter(e.target.value),
      onKeyUp: (e) => updateSearchFilter(e.target.value),
      placeholder: 'Search events',
      location: LEFT,
      search: true
    },
    {
      label: 'Add event',
      onClick: () => editEvent({ callback: eventAdded }),
      location: RIGHT
    }
  ];

  const target = document.getElementById(EVENTS_CONTROL);
  controlBar({ table, target, items });
}
