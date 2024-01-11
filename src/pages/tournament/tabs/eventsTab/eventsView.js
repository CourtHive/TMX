import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { createEventsTable } from 'components/tables/eventsTable/createEventsTable';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { mapEvent } from 'pages/tournament/tabs/eventsTab/mapEvent';
import { controlBar } from 'components/controlBar/controlBar';
import { editEvent } from './editEvent';

import { EVENTS_CONTROL, LEFT, OVERLAY, RIGHT } from 'constants/tmxConstants';
import { DELETE_EVENTS } from 'constants/mutationConstants';

export function eventsView() {
  const { table } = createEventsTable();

  const eventAdded = (result) => {
    if (result?.event) {
      const tableRow = mapEvent({ event: result.event });
      table?.updateOrAddData([tableRow]);
    }
  };

  const setSearchFilter = createSearchFilter(table);
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
      location: OVERLAY,
    },
    {
      onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && setSearchFilter(''),
      onChange: (e) => setSearchFilter(e.target.value),
      onKeyUp: (e) => setSearchFilter(e.target.value),
      clearSearch: () => setSearchFilter(''),
      placeholder: 'Search events',
      location: LEFT,
      search: true,
    },
    {
      onClick: () => editEvent({ callback: eventAdded }),
      label: 'Add event',
      location: RIGHT,
    },
  ];

  const target = document.getElementById(EVENTS_CONTROL);
  controlBar({ table, target, items });
}
