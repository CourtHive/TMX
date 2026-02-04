/**
 * Unscheduled matchUps grid control bar.
 * Provides filtering, search, auto-scheduling, and schedule clearing functionality.
 */
import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { tournamentEngine, tools } from 'tods-competition-factory';
import { autoScheduleMatchUps } from './autoScheduleMatchUps';
import { controlBar } from 'components/controlBar/controlBar';
import { findAncestor } from 'services/dom/parentAndChild';
import { clearSchedule } from './clearSchedule';

import { ALL_GENDERS, ALL_EVENTS, ALL_ROUNDS, ALL_FLIGHTS, LEFT, RIGHT } from 'constants/tmxConstants';

export function unscheduledGridControl({
  updateUnscheduledTable,
  updateScheduleTable,
  toggleUnscheduled,
  flightNameFilter,
  roundNameFilter,
  controlAnchor,
  eventIdFilter,
  scheduledDate,
  matchUps = [],
  genderFilter,
  table,
}: {
  updateUnscheduledTable: () => boolean;
  updateScheduleTable: (params: { scheduledDate: string }) => void;
  toggleUnscheduled: () => void;
  flightNameFilter?: string;
  roundNameFilter?: string;
  controlAnchor: HTMLElement;
  eventIdFilter?: string;
  genderFilter?: string;
  scheduledDate: string;
  matchUps?: any[];
  table: any;
}): { updateScheduledDate: (date: string) => void } {
  let currentScheduledDate = scheduledDate;
  const updateScheduledDate = (date: string) => {
    currentScheduledDate = date;
  };
  const eventFilter = (rowData: any) => rowData.eventId === eventIdFilter;
  const updateEventFilter = (eventId?: string) => {
    table.removeFilter(eventFilter);
    eventIdFilter = eventId;
    if (eventId) table.addFilter(eventFilter);
  };
  const events = tournamentEngine.getEvents().events || [];
  const allEvents = { label: ALL_EVENTS, onClick: () => updateEventFilter(), close: true };
  const eventOptions = [allEvents].concat(
    events.map((event: any) => ({
      onClick: () => updateEventFilter(event.eventId),
      label: event.eventName,
      close: true,
    })),
  );

  const genderFilterFx = (rowData: any) => rowData.gender === genderFilter;
  const updateGenderFilter = (gender?: string) => {
    table.removeFilter(genderFilterFx);
    genderFilter = gender;
    if (gender) table.addFilter(genderFilterFx);
  };
  const allGenders = { label: ALL_GENDERS, onClick: () => updateGenderFilter(), close: true };
  const genderOptions = [allGenders].concat(
    tools.unique(events.map((event: any) => event.gender)).map((gender: any) => ({
      onClick: () => updateGenderFilter(gender),
      label: gender,
      close: true,
    })),
  );

  const roundFilter = (rowData: any) => rowData.roundName === roundNameFilter;
  const roundNames = tools.unique(matchUps.map((matchUp: any) => matchUp.roundName));
  const updateRoundFilter = (roundName?: string) => {
    table.removeFilter(roundFilter);
    roundNameFilter = roundName;
    if (roundName) table.addFilter(roundFilter);
  };
  const allRounds = { label: ALL_ROUNDS, onClick: () => updateRoundFilter(), close: true };
  const roundOptions = [allRounds].concat(
    roundNames.map((roundName: string) => ({
      onClick: () => updateRoundFilter(roundName),
      label: roundName,
      close: true,
    })),
  );

  const flightFilter = (rowData: any) => rowData.flight === flightNameFilter;
  const flightNames = tools.unique(matchUps.map((matchUp: any) => matchUp.drawName));
  const updateFlightFilter = (flightName?: string) => {
    table.removeFilter(flightFilter);
    flightNameFilter = flightName;
    if (flightName) table.addFilter(flightFilter);
  };
  const allFlights = { label: ALL_FLIGHTS, onClick: () => updateFlightFilter(), close: true };
  const flightOptions = [allFlights].concat(
    flightNames.map((flightName: string) => ({
      onClick: () => updateFlightFilter(flightName),
      label: flightName,
      close: true,
    })),
  );

  const updateTables = () => {
    if (updateUnscheduledTable()) {
      updateScheduleTable({ scheduledDate: currentScheduledDate });
    }
    console.log('clear filters ?');
  };
  const scheduleClear = (e: Event) => {
    const result = findAncestor(e.target as HTMLElement, 'dropdown');
    clearSchedule({
      target: result || (e?.target as HTMLElement),
      scheduledDate: currentScheduledDate,
      callback: updateTables,
      roundNameFilter,
      eventIdFilter,
    });
  };

  const setSearchFilter = createSearchFilter(table);
  const autoScheduler = () =>
    autoScheduleMatchUps({ scheduledDate: currentScheduledDate, table, updateScheduleTable, updateUnscheduledTable });

  const actionOptions = [
    {
      onClick: autoScheduler,
      label: 'Auto schedule',
      intent: 'is-primary',
      id: 'autoSchedule',
      close: true,
    },
    {
      label: 'Clear schedule',
      onClick: scheduleClear,
      intent: 'is-warning',
      id: 'clearSchedule',
      close: true,
    },
  ];

  const items = [
    {
      onKeyDown: (e: KeyboardEvent) =>
        e.key === 'Backspace' && (e.target as HTMLInputElement).value.length === 1 && setSearchFilter(''),
      onChange: (e: Event) => setSearchFilter((e.target as HTMLInputElement).value),
      onKeyUp: (e: Event) => setSearchFilter((e.target as HTMLInputElement).value),
      clearSearch: () => setSearchFilter(''),
      placeholder: 'Search participants',
      location: LEFT,
      search: true,
    },
    {
      hide: genderOptions.length < 2,
      options: genderOptions,
      id: 'genderOptions',
      label: ALL_GENDERS,
      modifyLabel: true,
      location: LEFT,
      selection: true,
    },
    {
      hide: eventOptions.length < 2,
      options: eventOptions,
      id: 'eventOptions',
      label: ALL_EVENTS,
      modifyLabel: true,
      location: LEFT,
      selection: true,
    },
    {
      hide: roundOptions.length < 2,
      options: roundOptions,
      id: 'roundOptions',
      label: ALL_ROUNDS,
      modifyLabel: true,
      location: LEFT,
      selection: true,
    },
    {
      hide: flightOptions.length < 2,
      options: flightOptions,
      id: 'flightOptions',
      label: ALL_FLIGHTS,
      modifyLabel: true,
      location: LEFT,
      selection: true,
    },
    {
      options: actionOptions,
      label: 'Actions',
      selection: false,
      location: RIGHT,
      align: RIGHT,
    },
    {
      onClick: toggleUnscheduled,
      id: 'doneScheduling',
      intent: 'is-info',
      label: 'Done',
    },
  ];

  controlBar({ target: controlAnchor, items });
  return { updateScheduledDate };
}
