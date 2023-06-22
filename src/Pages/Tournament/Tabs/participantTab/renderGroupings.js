import { createTeamsTable } from 'components/tables/participantsTable/createTeamsTable';
import { createTeamsFromAttribute } from 'components/modals/createTeamFromAttribute';
import { getEventFilter } from 'components/tables/common/filters/eventFilter';
import { deleteSelectedParticipants } from './deleteSelectedParticipants';
import { addParticipantsToEvent } from './addParticipantsToEvent';
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
      table.removeFilter(searchFilter);
    }
    searchText = value;
    if (value) table.addFilter(searchFilter);
  };

  const { eventOptions, events } = getEventFilter(table);

  const refresh = () => replaceTableData();

  const actionOptions = [
    { label: 'New team', onClick: () => addTeam({ callback: refresh }) },
    { label: 'Create team', onClick: () => createTeamsFromAttribute({ callback: refresh }) }
  ];

  const addToEventOptions = [{ label: 'Create new event', close: true }].concat(
    events
      .filter(({ eventType }) => eventType === TEAM)
      .map((event) => ({
        onClick: () => addParticipantsToEvent({ event, table, callback: replaceTableData }),
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
      hide: !addToEventOptions.length,
      options: addToEventOptions,
      label: 'Add to event',
      intent: 'is-none',
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
