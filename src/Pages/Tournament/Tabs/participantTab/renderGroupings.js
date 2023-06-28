import { createTeamsTable } from 'components/tables/participantsTable/createTeamsTable';
import { createTeamsFromAttribute } from 'components/modals/createTeamFromAttribute';
import { getEventFilter } from 'components/tables/common/filters/eventFilter';
import { deleteSelectedParticipants } from './deleteSelectedParticipants';
import { addParticipantsToEvent } from './addParticipantsToEvent';
import { eventFromParticipants } from './eventFromParticipants';
import { participantConstants } from 'tods-competition-factory';
import { controlBar } from 'components/controlBar/controlBar';
import { participantOptions } from './participantOptions';
import { addTeam } from 'components/modals/addTeam';

import { TEAMS_CONTROL, OVERLAY, RIGHT, LEFT, ALL_EVENTS } from 'constants/tmxConstants';

const { TEAM } = participantConstants;

export function renderGroupings({ view }) {
  const { table, replaceTableData } = createTeamsTable({ view });

  // SEARCH filter
  let searchText;
  const searchFilter = (rowData) => rowData.searchText?.includes(searchText);
  const updateSearchFilter = (value) => {
    if (!value) {
      console.log('removing search filter');
      table?.removeFilter(searchFilter);
    }
    searchText = value;
    if (value) table?.addFilter(searchFilter);
  };

  const { eventOptions, events } = getEventFilter(table);

  const actionOptions = [
    { label: 'New team', onClick: () => addTeam({ callback: replaceTableData }) },
    { label: 'Create team', onClick: () => createTeamsFromAttribute({ callback: replaceTableData }) }
  ];

  const createNewEvent = {
    label: '<p style="font-weight: bold">Create new event</p>',
    onClick: () => eventFromParticipants(table),
    close: true
  };
  const addToEventOptions = [createNewEvent, { divider: true }].concat(
    events
      .filter(({ eventType }) => eventType === TEAM)
      .map((event) => ({
        onClick: () => addParticipantsToEvent({ event, participantType: TEAM, table, callback: replaceTableData }),
        label: event.eventName,
        close: true
      }))
  );

  const participantLabel = view === 'GROUP' ? 'Groups' : 'Teams';
  const items = [
    {
      onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateSearchFilter(''),
      onChange: (e) => updateSearchFilter(e.target.value),
      onKeyUp: (e) => updateSearchFilter(e.target.value),
      placeholder: 'Search teams',
      location: OVERLAY,
      search: true
    },
    {
      options: addToEventOptions,
      label: 'Add to event',
      hide: !events.length,
      intent: 'is-none',
      location: OVERLAY
    },
    {
      onClick: () => eventFromParticipants(table),
      label: 'Create event',
      hide: events.length,
      intent: 'is-info',
      location: OVERLAY
    },
    {
      onClick: () => deleteSelectedParticipants(table),
      label: 'Delete selected',
      intent: 'is-danger',
      stateChange: true,
      location: OVERLAY
    },
    {
      onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateSearchFilter(''),
      onChange: (e) => updateSearchFilter(e.target.value),
      onKeyUp: (e) => updateSearchFilter(e.target.value),
      placeholder: 'Search teams',
      location: LEFT,
      search: true
    },
    {
      hide: eventOptions.length < 2,
      options: eventOptions,
      modifyLabel: true,
      label: ALL_EVENTS,
      location: LEFT,
      selection: true
    },
    {
      options: participantOptions(view),
      label: participantLabel,
      modifyLabel: true,
      intent: 'is-info',
      location: RIGHT,
      selection: true,
      align: RIGHT
    },
    {
      options: actionOptions,
      label: 'Actions',
      selection: false,
      location: RIGHT,
      align: RIGHT
    }
  ];

  const target = document.getElementById(TEAMS_CONTROL);
  controlBar({ table, target, items });
}
