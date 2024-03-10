import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { createEventsTable } from 'components/tables/eventsTable/createEventsTable';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { mapEvent } from 'pages/tournament/tabs/eventsTab/mapEvent';
import { controlBar } from 'components/controlBar/controlBar';
import { tournamentEngine } from 'tods-competition-factory';
import { editEvent } from './editEvent';

import { EVENTS_CONTROL, LEFT, OVERLAY, RIGHT } from 'constants/tmxConstants';
import { DELETE_EVENTS } from 'constants/mutationConstants';

export function eventsView() {
  const tournamentPubState = tournamentEngine.getPublishState().publishState?.tournament;
  const somethingPublished = tournamentPubState?.status?.published;

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

  const oopAction = (published) => (published ? 'Unpublish' : 'Publish');
  const oopButtonLabel = (published) => `${oopAction(published)} OOP`;
  const updateOopState = (result) => {
    if (result?.success) {
      const tournamentPubState = tournamentEngine.getPublishState().publishState?.tournament;
      const button = document.getElementById('oopButton');
      button.innerText = oopButtonLabel(tournamentPubState?.orderOfPlay?.published);
      button.classList.toggle('is-primary');
    }
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
      onClick: () => toggleOOP(tournamentPubState?.orderOfPlay?.published, updateOopState),
      hide: !somethingPublished,
      label: oopButtonLabel(tournamentPubState?.orderOfPlay?.published),
      intent: tournamentPubState?.orderOfPlay?.published ? 'is-primary' : '',
      id: 'oopButton',
      location: RIGHT,
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

function toggleOOP(published, callback) {
  const method = published ? 'unPublishOrderOfPlay' : 'publishOrderOfPlay';
  const methods = [{ method }];
  mutationRequest({ methods, callback });
}
