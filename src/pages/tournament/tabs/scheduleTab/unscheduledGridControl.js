import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { tournamentEngine, tools } from 'tods-competition-factory';
import { autoScheduleMatchUps } from './autoScheduleMatchUps';
import { controlBar } from 'components/controlBar/controlBar';
import { findAncestor } from 'services/dom/parentAndChild';
import { clearSchedule } from './clearSchedule';

import { LEFT, RIGHT } from 'constants/tmxConstants';

const ALL_EVENTS = 'All events';
const ALL_ROUNDS = 'All rounds';

export function unscheduledGridControl({
  updateUnscheduledTable,
  updateScheduleTable,
  toggleUnscheduled,
  roundNameFilter,
  controlAnchor,
  eventIdFilter,
  scheduledDate,
  matchUps = [],
  table,
}) {
  const eventFilter = (rowData) => rowData.eventId === eventIdFilter;
  const updateEventFilter = (eventId) => {
    table.removeFilter(eventFilter);
    eventIdFilter = eventId;
    if (eventId) table.addFilter(eventFilter);
  };
  const events = tournamentEngine.getEvents().events || [];
  const allEvents = { label: ALL_EVENTS, onClick: () => updateEventFilter(), close: true };
  const eventOptions = [allEvents].concat(
    events.map((event) => ({
      onClick: () => updateEventFilter(event.eventId),
      label: event.eventName,
      close: true,
    })),
  );

  const roundFilter = (rowData) => rowData.roundName === roundNameFilter;
  const roundNames = tools.unique(matchUps.map((matchUp) => matchUp.roundName));
  const updateRoundFilter = (roundName) => {
    table.removeFilter(roundFilter);
    roundNameFilter = roundName;
    if (roundName) table.addFilter(roundFilter);
  };
  const allRounds = { label: ALL_ROUNDS, onClick: () => updateRoundFilter(), close: true };
  const roundOptions = [allRounds].concat(
    roundNames.map((roundName) => ({
      onClick: () => updateRoundFilter(roundName),
      label: roundName,
      close: true,
    })),
  );

  const updateTables = () => {
    updateUnscheduledTable() && updateScheduleTable();
    console.log('clear filters ?');
  };
  const scheduleClear = (e) => {
    const result = findAncestor(e.target, 'dropdown');
    clearSchedule({
      target: result || e?.target,
      callback: updateTables,
      roundNameFilter,
      eventIdFilter,
      scheduledDate,
      eventFilter,
      roundFilter,
    });
  };

  const setSearchFilter = createSearchFilter(table);
  const autoScheduler = () =>
    autoScheduleMatchUps({ scheduledDate, table, updateScheduleTable, updateUnscheduledTable });

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
      onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && setSearchFilter(''),
      onChange: (e) => setSearchFilter(e.target.value),
      onKeyUp: (e) => setSearchFilter(e.target.value),
      clearSearch: () => setSearchFilter(''),
      placeholder: 'Search participants',
      location: LEFT,
      search: true,
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

  controlBar({ target: controlAnchor, items }).elements;
}
