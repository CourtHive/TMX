import { tournamentEngine, participantConstants, eventConstants } from 'tods-competition-factory';
import { createMatchUpsTable } from 'components/tables/matchUpsTable/createMatchUpsTable';
import { getTeamVs, getSideScore, getSide } from 'components/elements/getTeamVs';
import { dropDownButton } from 'components/buttons/dropDownButton';
import { removeAllChildNodes } from 'services/dom/transformers';
import { controlBar } from 'components/controlBar/controlBar';
import { env } from 'settings/env';

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
  TEAM_STATS,
} from 'constants/tmxConstants';

const { TEAM_EVENT, SINGLES, DOUBLES } = eventConstants;
const { TEAM } = participantConstants;

export function renderMatchUpTab() {
  const matchUpFilters = new Map();
  const components = { elements: {} };

  const { data, table, replaceTableData } = createMatchUpsTable();
  const events = tournamentEngine.getEvents().events || [];
  const statsPanel = document.getElementById(TEAM_STATS);
  statsPanel.style.display = NONE;

  // FILTER: flights
  const flightFilter = (rowData) => rowData.drawId === matchUpFilters.get('drawIdFilter');
  const updateFlightFilter = (drawId) => {
    table?.removeFilter(flightFilter);
    matchUpFilters.set('drawIdFilter', drawId);
    if (drawId) table?.addFilter(flightFilter);
  };
  const allFlights = {
    label: `<span style='font-weight: bold'>${ALL_FLIGHTS}</span>`,
    onClick: () => updateFlightFilter(),
    close: true,
  };
  const getFlightOptions = (event) =>
    event.drawDefinitions?.map(({ drawId, drawName }) => ({
      onClick: () => updateFlightFilter(drawId),
      label: drawName,
      close: true,
    }));
  const flightOptions = [allFlights, { divider: true }].concat(events.flatMap(getFlightOptions)).filter(Boolean);

  // FILTER: events
  const eventFilter = (rowData) => rowData.eventId === matchUpFilters.get('eventIdFilter');
  const updateEventFilter = (eventId) => {
    table?.removeFilter(eventFilter);
    matchUpFilters.set('eventIdFilter', eventId);
    table?.removeFilter(flightFilter);
    matchUpFilters.set('drawIdFilter', undefined);
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
        location: LEFT,
      };
      const elem = dropDownButton({ button: flightButton });

      components.elements.flightOptions.replaceWith(elem);
      components.elements.flightOptions = elem;
    } else {
      components.elements.flightOptions.style.display = NONE;
    }
  };
  const allEvents = {
    label: `<span style='font-weight: bold'>${ALL_EVENTS}</span>`,
    onClick: () => updateEventFilter(),
    close: true,
  };
  const eventOptions = [allEvents, { divider: true }].concat(
    events.map((event) => ({
      onClick: () => updateEventFilter(event.eventId),
      label: event.eventName,
      close: true,
    })),
  );

  // FILTER: matchUpStatus
  const statusFilter = (rowData) => {
    const currentFilter = matchUpFilters.get('matchUpStatusFilter');
    if (currentFilter === 'readyToScore') {
      return rowData.scoreDetail.readyToScore && !rowData.scoreDetail.score && !rowData.scoreDetail.winningSide;
    } else if (currentFilter === 'complete') {
      return (
        rowData.scoreDetail.winningSide ||
        ['DOUBLE_WALKOVER', 'DOUBLE_DEFAULT', 'CANCELLED', 'ABANDONED'].includes(rowData.scoreDetail.matchUpStatus)
      );
    }
  };
  const updateStatusFilter = (status) => {
    table?.removeFilter(statusFilter);
    matchUpFilters.set('matchUpStatusFilter', status);
    if (status) table?.addFilter(statusFilter);
  };
  const allStatuses = {
    label: `<span style='font-weight: bold'>${ALL_STATUSES}</span>`,
    onClick: () => updateStatusFilter(),
    close: true,
  };
  const scoreOptions = [
    allStatuses,
    { divider: true },
    { label: 'Ready to score', close: true, onClick: () => updateStatusFilter('readyToScore') },
    { label: 'Complete', close: true, onClick: () => updateStatusFilter('complete') },
  ];

  // SEARCH filter
  const searchFilter = (rowData) => rowData.searchText?.includes(matchUpFilters.get('searchText'));
  const updateSearchFilter = (value) => {
    if (!value) table?.removeFilter(searchFilter);
    matchUpFilters.set('searchText', value);
    if (value) table?.addFilter(searchFilter);
  };

  // FILTER: type
  const typeFilter = (rowData) => rowData.matchUpType === matchUpFilters.get('matchUpTypeFilter');
  const updateTypeFilter = (type) => {
    table?.removeFilter(typeFilter);
    matchUpFilters.set('matchUpTypeFilter', type);
    if (type) table?.addFilter(typeFilter);
  };
  const ALL_TYPES = 'All Types';
  const allTypes = {
    label: `<span style='font-weight: bold'>${ALL_TYPES}</span>`,
    onClick: () => updateTypeFilter(),
    close: true,
  };
  const matchUpTypes = data.reduce((types, matchUp) => {
    if (!types.includes(matchUp.matchUpType)) types.push(matchUp.matchUpType);
    return types;
  }, []);
  const typeOptions = [
    allTypes,
    { divider: true },
    matchUpTypes.includes(SINGLES) && { label: 'Singles', close: true, onClick: () => updateTypeFilter(SINGLES) },
    matchUpTypes.includes(DOUBLES) && { label: 'Doubles', close: true, onClick: () => updateTypeFilter(DOUBLES) },
    matchUpTypes.includes(TEAM_EVENT) && { label: 'Team', close: true, onClick: () => updateTypeFilter(TEAM_EVENT) },
  ].filter(Boolean);

  // FILTER: teams
  const teamParticipants =
    tournamentEngine.getParticipants({ participantFilters: { participantTypes: [TEAM] } }).participants || [];
  const teamMap = Object.assign(
    {},
    ...teamParticipants.map((p) => ({ [p.participantId]: p.individualParticipantIds })),
  );
  const teamFilter = (rowData) =>
    rowData.individualParticipantIds.some((id) => teamMap[matchUpFilters.get('teamIdFilter')]?.includes(id));
  const updateTeamFilter = (teamParticipantId) => {
    if (matchUpFilters.get('teamIdFilter')) table?.removeFilter(teamFilter);
    matchUpFilters.set('teamIdFilter', teamParticipantId);
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
    close: true,
  };

  // TODO: teamOptions => use element.options.replaceWith to update to only those teams with results
  const teamOptions = [allTeams, { divider: true }].concat(
    teamParticipants
      .sort((a, b) => a?.participantName?.localeCompare(b?.participantName))
      .map((team) => ({
        onClick: () => updateTeamFilter(team.participantId),
        label: team.participantName,
        close: true,
      })),
  );

  const items = [
    {
      onClick: () => table?.deselectRow(),
      label: 'Schedule',
      stateChange: true,
      location: OVERLAY,
    },
    {
      onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateSearchFilter(''),
      onKeyUp: (e) => updateSearchFilter(e.target.value),
      clearSearch: () => {
        // remove whatever filter is currently in place
        table?.removeFilter(searchFilter);
        // reset searchText
        matchUpFilters.set('searchText', '');
        // set filter to empty value
        table?.removeFilter();
      },
      placeholder: 'Search matches',
      location: LEFT,
      search: true,
    },
    {
      hide: eventOptions.length < 4,
      options: eventOptions,
      id: 'eventOptions',
      label: ALL_EVENTS,
      modifyLabel: true,
      selection: true,
      location: LEFT,
    },
    {
      options: flightOptions,
      label: ALL_FLIGHTS,
      id: 'flightOptions',
      modifyLabel: true,
      selection: true,
      location: LEFT,
      hide: true,
    },
    {
      hide: teamOptions.length < 3,
      options: teamOptions,
      modifyLabel: true,
      label: ALL_TEAMS,
      location: LEFT,
      selection: true,
    },
    {
      options: scoreOptions,
      label: ALL_STATUSES,
      modifyLabel: true,
      selection: true,
      location: LEFT,
    },
    {
      hide: typeOptions.length < 4,
      options: typeOptions,
      modifyLabel: true,
      label: ALL_TYPES,
      selection: true,
      location: LEFT,
    },
    {
      onClick: () => {
        env.activeScale = 'wtn';
        replaceTableData();
      },
      id: 'wtnPredictiveAccuracy',
      intent: 'is-danger',
      location: RIGHT,
      text: 'WTN %',
      hide: true,
    },
    {
      onClick: () => {
        env.activeScale = 'utr';
        replaceTableData();
      },
      id: 'utrPredictiveAccuracy',
      intent: 'is-info',
      location: RIGHT,
      text: 'UTR %',
      hide: true,
    },
  ];

  const target = document.getElementById(MATCHUPS_CONTROL);
  components.elements = controlBar({ table, target, items }).elements;
}
