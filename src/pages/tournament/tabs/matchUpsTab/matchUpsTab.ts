/**
 * MatchUps tab with filtering and statistics.
 * Displays all tournament matches with search, event, flight, team, status, and type filters.
 */
import { tournamentEngine, participantConstants, eventConstants } from 'tods-competition-factory';
import { createMatchUpsTable } from 'components/tables/matchUpsTable/createMatchUpsTable';
import { getTeamVs, getSideScore, getSide } from 'components/elements/getTeamVs';
import { controlBar, dropDownButton } from 'courthive-components';
import { removeAllChildNodes } from 'services/dom/transformers';
import { setActiveScale } from 'settings/setActiveScale';
import { t } from 'i18n';

// constants
import { LEFT, MATCHUPS_CONTROL, NONE, OVERLAY, RIGHT, TEAM_STATS, UTR, WTN } from 'constants/tmxConstants';

const { TEAM_EVENT, SINGLES, DOUBLES } = eventConstants;
const { TEAM } = participantConstants;

const ALL_FLIGHTS_KEY = 'pages.matchUps.allFlights';
const DRAW_ID_FILTER = 'drawIdFilter';
const TEAM_ID_FILTER = 'teamIdFilter';

export function renderMatchUpTab(): void {
  const matchUpFilters = new Map();
  const components: any = { elements: {}, options: {} };

  const { data, table, replaceTableData } = createMatchUpsTable();
  const events = tournamentEngine.getEvents().events || [];
  const statsPanel = document.getElementById(TEAM_STATS)!;
  statsPanel.style.display = NONE;

  components.options.flight = getFlightOptions({
    matchUpFilters,
    events,
    table,
  });

  const eventOptions = getEventOptions({
    matchUpFilters,
    components,
    events,
    table,
  });
  const teamOptions = getTeamOptions({ table, matchUpFilters, statsPanel });
  const typeOptions = getTypeOptions({ table, matchUpFilters, data });
  const statusOptions = getStatusOptions({ matchUpFilters, table });

  const SEARCH_TEXT = 'searchText';
  const searchFilter = (rowData: any) => rowData.searchText?.includes(matchUpFilters.get(SEARCH_TEXT));
  const updateSearchFilter = (value: string) => {
    if (!value) table?.removeFilter(searchFilter);
    matchUpFilters.set(SEARCH_TEXT, value);
    if (value) table?.addFilter(searchFilter);
  };

  const items = [
    {
      onClick: () => table?.deselectRow(),
      label: t('pages.matchUps.schedule'),
      stateChange: true,
      location: OVERLAY,
    },
    {
      onKeyDown: (e: any) => e.keyCode === 8 && e.target.value.length === 1 && updateSearchFilter(''),
      onKeyUp: (e: any) => updateSearchFilter(e.target.value),
      clearSearch: () => {
        table?.removeFilter(searchFilter);
        matchUpFilters.set(SEARCH_TEXT, '');
        table?.removeFilter();
      },
      placeholder: t('pages.matchUps.searchMatches'),
      location: LEFT,
      search: true,
    },
    {
      hide: eventOptions.length < 4,
      options: eventOptions,
      id: 'eventOptions',
      label: t('pages.matchUps.allEvents'),
      modifyLabel: true,
      selection: true,
      location: LEFT,
    },
    {
      options: components.options.flight.flightOptions,
      hide: !matchUpFilters.get(EVENT_ID_FILTER) || components.options.flight.flightOptions.length < 3,
      label: t(ALL_FLIGHTS_KEY),
      id: 'flightOptions',
      modifyLabel: true,
      selection: true,
      location: LEFT,
    },
    {
      hide: teamOptions.length < 3,
      options: teamOptions,
      modifyLabel: true,
      label: t('pages.matchUps.allTeams'),
      location: LEFT,
      selection: true,
    },
    {
      options: statusOptions,
      label: t('pages.matchUps.allStatuses'),
      modifyLabel: true,
      selection: true,
      location: LEFT,
    },
    {
      hide: typeOptions.length < 4,
      options: typeOptions,
      modifyLabel: true,
      label: t('pages.matchUps.allTypes'),
      selection: true,
      location: LEFT,
    },
    {
      onClick: () => {
        setActiveScale(WTN);
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
        setActiveScale(UTR);
        replaceTableData();
      },
      id: 'utrPredictiveAccuracy',
      intent: 'is-info',
      location: RIGHT,
      text: 'UTR %',
      hide: true,
    },
  ];

  const target = document.getElementById(MATCHUPS_CONTROL)!;
  components.elements = controlBar({ table, target, items })?.elements;
}

function getTypeOptions({ table, matchUpFilters, data }: any): any[] {
  const typeFilter = (rowData: any) => rowData.matchUpType === matchUpFilters.get('matchUpTypeFilter');
  const updateTypeFilter = (type?: string) => {
    table?.removeFilter(typeFilter);
    matchUpFilters.set('matchUpTypeFilter', type);
    if (type) table?.addFilter(typeFilter);
  };
  const allTypes = {
    label: `<span style='font-weight: bold'>${t('pages.matchUps.allTypes')}</span>`,
    onClick: () => updateTypeFilter(),
    close: true,
  };
  const matchUpTypes = data.reduce((types: string[], matchUp: any) => {
    if (!types.includes(matchUp.matchUpType)) types.push(matchUp.matchUpType);
    return types;
  }, []);
  return [
    allTypes,
    { divider: true },
    matchUpTypes.includes(SINGLES) && {
      label: t('pages.matchUps.singles'),
      close: true,
      onClick: () => updateTypeFilter(SINGLES),
    },
    matchUpTypes.includes(DOUBLES) && {
      label: t('pages.matchUps.doubles'),
      close: true,
      onClick: () => updateTypeFilter(DOUBLES),
    },
    matchUpTypes.includes(TEAM_EVENT) && {
      label: t('pages.matchUps.team'),
      close: true,
      onClick: () => updateTypeFilter(TEAM_EVENT),
    },
  ].filter(Boolean);
}

function getTeamOptions({ table, matchUpFilters, statsPanel }: any): any[] {
  const teamParticipants =
    tournamentEngine.getParticipants({ participantFilters: { participantTypes: [TEAM] } }).participants || [];
  const teamMap = Object.assign(
    {},
    ...teamParticipants.map((p: any) => ({ [p.participantId]: p.individualParticipantIds })),
  );
  const teamFilter = (rowData: any) =>
    rowData.individualParticipantIds.some((id: string) => teamMap[matchUpFilters.get(TEAM_ID_FILTER)]?.includes(id));
  const updateTeamFilter = (teamParticipantId?: string) => {
    if (matchUpFilters.get(TEAM_ID_FILTER)) table?.removeFilter(teamFilter);
    matchUpFilters.set(TEAM_ID_FILTER, teamParticipantId);
    if (teamParticipantId) {
      table?.addFilter(teamFilter);
      const { teamStats } = tournamentEngine.getParticipantStats({ teamParticipantId });
      if (teamStats?.participantName) {
        statsPanel.style.display = '';
        const side1 = getSide({ participantName: teamStats.participantName, justify: 'end' });
        const side2 = getSide({ participantName: t('pages.matchUps.opponents'), justify: 'start' });
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
    label: `<span style='font-weight: bold'>${t('pages.matchUps.allTeams')}</span>`,
    onClick: () => updateTeamFilter(),
    close: true,
  };

  return [allTeams, { divider: true }].concat(
    teamParticipants
      .sort((a: any, b: any) => a?.participantName?.localeCompare(b?.participantName))
      .map((team: any) => ({
        onClick: () => updateTeamFilter(team.participantId),
        label: team.participantName,
        close: true,
      })),
  );
}

function getStatusOptions({ matchUpFilters, table }: any): any[] {
  const statusFilter = (rowData: any) => {
    const currentFilter = matchUpFilters.get('matchUpStatusFilter');
    if (currentFilter === 'readyToScore') {
      return (
        rowData.scoreDetail.readyToScore &&
        !rowData.scoreDetail.score &&
        !rowData.scoreDetail.winningSide &&
        !['DOUBLE_WALKOVER', 'DOUBLE_DEFAULT', 'CANCELLED', 'ABANDONED'].includes(rowData.scoreDetail.matchUpStatus)
      );
    } else if (currentFilter === 'complete') {
      return (
        rowData.scoreDetail.winningSide ||
        ['DOUBLE_WALKOVER', 'DOUBLE_DEFAULT', 'CANCELLED', 'ABANDONED'].includes(rowData.scoreDetail.matchUpStatus)
      );
    }
  };
  const updateStatusFilter = (status?: string) => {
    table?.removeFilter(statusFilter);
    matchUpFilters.set('matchUpStatusFilter', status);
    if (status) table?.addFilter(statusFilter);
  };
  const allStatuses = {
    label: `<span style='font-weight: bold'>${t('pages.matchUps.allStatuses')}</span>`,
    onClick: () => updateStatusFilter(),
    close: true,
  };
  return [
    allStatuses,
    { divider: true },
    { label: t('pages.matchUps.readyToScore'), close: true, onClick: () => updateStatusFilter('readyToScore') },
    { label: t('pages.matchUps.complete'), close: true, onClick: () => updateStatusFilter('complete') },
  ];
}

function getFlightOptions({ matchUpFilters, events, table }: any): any {
  const flightFilter = (rowData: any) => rowData.drawId === matchUpFilters.get(DRAW_ID_FILTER);
  const updateFlightFilter = (drawId?: string) => {
    table?.removeFilter(flightFilter);
    matchUpFilters.set(DRAW_ID_FILTER, drawId);
    if (drawId) table?.addFilter(flightFilter);
  };
  const allFlights = {
    label: `<span style='font-weight: bold'>${t(ALL_FLIGHTS_KEY)}</span>`,
    onClick: () => updateFlightFilter(),
    close: true,
  };
  const mapFlightOptions = (event: any) =>
    event.drawDefinitions?.map(({ drawId, drawName }: any) => ({
      onClick: () => updateFlightFilter(drawId),
      label: drawName,
      close: true,
    }));
  const flightOptions = [allFlights, { divider: true }].concat(events.flatMap(mapFlightOptions)).filter(Boolean);
  return { flightFilter, flightOptions, allFlights, mapFlightOptions };
}

const EVENT_ID_FILTER = 'eventIdFilter';

function getEventOptions({ matchUpFilters, table, events, components }: any): any[] {
  const eventFilter = (rowData: any) => rowData.eventId === matchUpFilters.get(EVENT_ID_FILTER);
  const updateEventFilter = (eventId?: string) => {
    table?.removeFilter(eventFilter);
    matchUpFilters.set(EVENT_ID_FILTER, eventId);
    table?.removeFilter(components.options.flight.flightFilter);
    matchUpFilters.set(DRAW_ID_FILTER, undefined);
    if (eventId) {
      table?.addFilter(eventFilter);
      components.options.flight.flightOptions = [components.options.flight.allFlights, { divider: true }]
        .concat(components.options.flight.mapFlightOptions(events.find((event: any) => eventId === event.eventId)))
        .filter(Boolean);

      const flightButton = {
        options: components.options.flight.flightOptions,
        label: t(ALL_FLIGHTS_KEY),
        id: 'flightOptions',
        modifyLabel: true,
        selection: true,
        location: LEFT,
      };
      const elem = dropDownButton({ button: flightButton });
      components.elements.flightOptions.replaceWith(elem);
      components.elements.flightOptions = elem;
      components.elements.flightOptions.style.display = components.options.flight.flightOptions.length < 3 ? NONE : '';
    } else {
      components.elements.flightOptions.style.display = NONE;
    }
  };
  const allEvents = {
    label: `<span style='font-weight: bold'>${t('pages.matchUps.allEvents')}</span>`,
    onClick: () => updateEventFilter(),
    close: true,
  };
  return [allEvents, { divider: true }].concat(
    events.map((event: any) => ({
      onClick: () => updateEventFilter(event.eventId),
      label: event.eventName,
      close: true,
    })),
  );
}
