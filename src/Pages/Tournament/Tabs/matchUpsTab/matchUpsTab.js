import { createMatchUpsTable } from 'components/tables/matchUpsTable/createMatchUpsTable';
import { tournamentEngine, participantConstants } from 'tods-competition-factory';
import { getTeamVs, getSideScore, getSide } from 'components/elements/getTeamVs';
import { dropDownButton } from 'components/buttons/dropDownButton';
import { removeAllChildNodes } from 'services/dom/transformers';
import { controlBar } from 'components/controlBar/controlBar';

import {
  ALL_EVENTS,
  ALL_FLIGHTS,
  ALL_STATUSES,
  ALL_TEAMS,
  LEFT,
  MATCHUPS_CONTROL,
  NONE,
  OVERLAY,
  RIGHT,
  TEAM_STATS
} from 'constants/tmxConstants';

const { TEAM } = participantConstants;

export function renderMatchUpTab() {
  let eventIdFilter, drawIdFilter, teamIdFilter, matchUpStatusFilter, elements;

  const { table } = createMatchUpsTable({ elements });
  const events = tournamentEngine.getEvents().events || [];
  const statsPanel = document.getElementById(TEAM_STATS);
  statsPanel.style.display = NONE;

  // FILTER: flights
  const flightFilter = (rowData) => rowData.drawId === drawIdFilter;
  const updateFlightFilter = (drawId) => {
    table?.removeFilter(flightFilter);
    drawIdFilter = drawId;
    if (drawId) table?.addFilter(flightFilter);
  };
  const allFlights = {
    label: `<span style='font-weight: bold'>${ALL_FLIGHTS}</span>`,
    onClick: () => updateFlightFilter(),
    close: true
  };
  const getFlightOptions = (event) =>
    event.drawDefinitions?.map(({ drawId, drawName }) => ({
      onClick: () => updateFlightFilter(drawId),
      label: drawName,
      close: true
    }));
  const flightOptions = [allFlights, { divider: true }].concat(events.flatMap(getFlightOptions)).filter(Boolean);

  // FILTER: events
  const eventFilter = (rowData) => rowData.eventId === eventIdFilter;
  const updateEventFilter = (eventId) => {
    table?.removeFilter(eventFilter);
    eventIdFilter = eventId;
    table?.removeFilter(flightFilter);
    drawIdFilter = undefined;
    if (eventId) {
      table?.addFilter(eventFilter);
      const eventFlightOptions = [allFlights, { divider: true }]
        .concat(getFlightOptions(events.find((event) => eventId === event.eventId)))
        .filter(Boolean);
      const flightButton = {
        options: eventFlightOptions,
        label: ALL_FLIGHTS,
        id: 'flightOptions',
        modifyLabel: true,
        selection: true,
        location: LEFT
      };
      const elem = dropDownButton({ button: flightButton });

      elements.flightOptions.replaceWith(elem);
      elements.flightOptions = elem;
    } else {
      elements.flightOptions.style.display = NONE;
    }
  };
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

  const statusFilter = (rowData) => {
    if (matchUpStatusFilter === 'readyToScore') {
      return rowData.scoreDetail.readyToScore && !rowData.scoreDetail.score && !rowData.scoreDetail.winningSide;
    } else if (matchUpStatusFilter === 'complete') {
      return (
        rowData.scoreDetail.winningSide ||
        ['DOUBLE_WALKOVER', 'DOUBLE_DEFAULT', 'CANCELLED', 'ABANDONED'].includes(rowData.scoreDetail.matchUpStatus)
      );
    }
  };
  const updateStatusFilter = (status) => {
    table?.removeFilter(statusFilter);
    matchUpStatusFilter = status;
    if (matchUpStatusFilter) {
      table?.addFilter(statusFilter);
    }
  };
  const allStatuses = {
    label: `<span style='font-weight: bold'>${ALL_STATUSES}</span>`,
    onClick: () => updateStatusFilter(),
    close: true
  };
  const scoreOptions = [
    allStatuses,
    { divider: true },
    { label: 'Ready to score', close: true, onClick: () => updateStatusFilter('readyToScore') },
    { label: 'Complete', close: true, onClick: () => updateStatusFilter('complete') }
  ];

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
  const updateTeamFilter = (teamParticipantId) => {
    if (teamIdFilter) table?.removeFilter(teamFilter);
    teamIdFilter = teamParticipantId;
    if (teamParticipantId) {
      table?.addFilter(teamFilter);
      const { teamStats } = tournamentEngine.getParticipantStats({ teamParticipantId });
      if (teamStats?.participantName) {
        statsPanel.style.display = '';
        const side1 = getSide({ participantName: teamStats.participantName, justify: 'end' });
        const side2 = getSide({ participantName: 'Opponents', justify: 'start' });
        const sets = [{ side1Score: teamStats.matchUps[0], side2Score: teamStats.matchUps[1] }];
        const side1Score = getSideScore({ sets, sideNumber: 1 });
        const side2Score = getSideScore({ sets, sideNumber: 2 });
        removeAllChildNodes(statsPanel);
        statsPanel.appendChild(getTeamVs({ side1, side2, side1Score, side2Score }));
      }
    } else {
      statsPanel.style.display = NONE;
    }
  };
  const allTeams = {
    label: `<span style='font-weight: bold'>${ALL_TEAMS}</span>`,
    onClick: () => updateTeamFilter(),
    close: true
  };

  // TODO: teamOptions => use element.options.replaceWith to update to only those teams with results
  const teamOptions = [allTeams, { divider: true }].concat(
    teamParticipants
      .sort((a, b) => a?.participantName?.localeCompare(b?.participantName))
      .map((team) => ({
        onClick: () => updateTeamFilter(team.participantId),
        label: team.participantName,
        close: true
      }))
  );

  const items = [
    {
      onClick: () => table?.deselectRow(),
      label: 'Schedule',
      stateChange: true,
      location: OVERLAY
    },
    {
      onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateSearchFilter(''),
      onKeyUp: (e) => updateSearchFilter(e.target.value),
      clearSearch: () => {
        // remove whatever filter is currently in place
        table?.removeFilter(searchFilter);
        // reset searchText
        searchText = '';
        // set filter to empty value
        table?.removeFilter();
      },
      placeholder: 'Search matches',
      location: LEFT,
      search: true
    },
    {
      hide: eventOptions.length < 3,
      options: eventOptions,
      id: 'eventOptions',
      label: ALL_EVENTS,
      modifyLabel: true,
      selection: true,
      location: LEFT
    },
    {
      options: flightOptions,
      label: ALL_FLIGHTS,
      id: 'flightOptions',
      modifyLabel: true,
      selection: true,
      location: LEFT,
      hide: true
    },
    {
      hide: teamOptions.length < 3,
      options: teamOptions,
      modifyLabel: true,
      label: ALL_TEAMS,
      location: LEFT,
      selection: true
    },
    {
      options: scoreOptions,
      label: ALL_STATUSES,
      modifyLabel: true,
      selection: true,
      location: LEFT
    },
    {
      id: 'wtnPredictiveAccuracy',
      intent: 'is-danger',
      location: RIGHT,
      text: 'WTN %',
      hide: true
    },
    {
      id: 'utrPredictiveAccuracy',
      intent: 'is-info',
      location: RIGHT,
      text: 'UTR %',
      hide: true
    }
  ];

  const target = document.getElementById(MATCHUPS_CONTROL);
  elements = controlBar({ table, target, items }).elements;
}
