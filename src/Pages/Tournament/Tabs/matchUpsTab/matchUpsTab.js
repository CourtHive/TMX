import { createMatchUpsTable } from 'components/tables/matchUpsTable/createMatchUpsTable';
import { tournamentEngine, participantConstants } from 'tods-competition-factory';
import { controlBar } from 'components/controlBar/controlBar';

import { ALL_EVENTS, ALL_TEAMS, LEFT, MATCHUPS_CONTROL, OVERLAY } from 'constants/tmxConstants';

const { TEAM } = participantConstants;

export function renderMatchUpTab() {
  let eventIdFilter, teamIdFilter;

  const { table } = createMatchUpsTable();

  // FILTER: events
  const eventFilter = (rowData) => rowData.eventId === eventIdFilter;
  const updateEventFilter = (eventId) => {
    table?.removeFilter(eventFilter);
    eventIdFilter = eventId;
    if (eventId) table?.addFilter(eventFilter);
  };
  const events = tournamentEngine.getEvents().events || [];
  const allEvents = {
    label: `<span style='font-weight: bold'>${ALL_EVENTS}</span>`,
    onClick: () => updateEventFilter(),
    close: true
  };
  const eventOptions = [allEvents, { divider: true }].concat(
    events.map((event) => ({
      onClick: () => updateEventFilter(event.eventId),
      label: event.eventName,
      close: true
    }))
  );

  // SEARCH filter
  let searchText;
  const searchFilter = (rowData) => rowData.searchText?.includes(searchText);
  const updateSearchFilter = (value) => {
    if (!value) table?.removeFilter(searchFilter);
    searchText = value;
    if (value) table?.addFilter(searchFilter);
  };

  // FILTER: teams
  const teamParticipants =
    tournamentEngine.getParticipants({ participantFilters: { participantTypes: [TEAM] } }).participants || [];
  const teamMap = Object.assign(
    {},
    ...teamParticipants.map((p) => ({ [p.participantId]: p.individualParticipantIds }))
  );
  const teamFilter = (rowData) => rowData.individualParticipantIds.some((id) => teamMap[teamIdFilter]?.includes(id));
  const updateTeamFilter = (teamId) => {
    if (teamIdFilter) table?.removeFilter(teamFilter);
    teamIdFilter = teamId;
    if (teamId) table?.addFilter(teamFilter);
  };
  const allTeams = {
    label: `<span style='font-weight: bold'>${ALL_TEAMS}</span>`,
    onClick: () => updateTeamFilter(),
    close: true
  };
  const teamOptions = [allTeams, { divider: true }].concat(
    teamParticipants.map((team) => ({
      onClick: () => updateTeamFilter(team.participantId),
      label: team.participantName,
      close: true
    }))
  );

  const items = [
    {
      onClick: () => {
        table.deselectRow();
      },
      label: 'Schedule',
      stateChange: true,
      location: OVERLAY
    },
    {
      onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateSearchFilter(''),
      onChange: (e) => updateSearchFilter(e.target.value),
      onKeyUp: (e) => updateSearchFilter(e.target.value),
      clearSearch: () => updateSearchFilter(''),
      placeholder: 'Search matches',
      location: LEFT,
      search: true
    },
    {
      hide: eventOptions.length < 3,
      options: eventOptions,
      label: ALL_EVENTS,
      modifyLabel: true,
      location: LEFT,
      selection: true
    },
    {
      hide: teamOptions.length < 3,
      options: teamOptions,
      label: ALL_TEAMS,
      location: LEFT,
      modifyLabel: true,
      selection: true
    }
  ];

  const target = document.getElementById(MATCHUPS_CONTROL);
  controlBar({ table, target, items });
}
