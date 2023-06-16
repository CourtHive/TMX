import { tournamentEngine, utilities } from 'tods-competition-factory';
import { autoScheduleMatchUps } from './autoScheduleMatchUps';
import { controlBar } from 'components/controlBar/controlBar';
import { clearSchedule } from './clearSchedule';

import { LEFT } from 'constants/tmxConstants';

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
  table
}) {
  const eventFilter = (rowData) => rowData.eventId === eventIdFilter;
  const updateEventFilter = (eventId) => {
    if (eventIdFilter) table.removeFilter(eventFilter);
    eventIdFilter = eventId;
    if (eventId) table.addFilter(eventFilter);
  };
  const events = tournamentEngine.getEvents().events || [];
  const allEvents = { label: ALL_EVENTS, onClick: updateEventFilter, close: true };
  const eventOptions = [allEvents].concat(
    events.map((event) => ({
      onClick: () => updateEventFilter(event.eventId),
      label: event.eventName,
      close: true
    }))
  );

  const roundFilter = (rowData) => rowData.roundName === roundNameFilter;
  const roundNames = utilities.unique(matchUps.map((matchUp) => matchUp.roundName));
  const updateRoundFilter = (roundName) => {
    if (roundNameFilter) table.removeFilter(roundFilter);
    roundNameFilter = roundName;
    if (roundName) table.addFilter(roundFilter);
  };
  const allRounds = { label: ALL_ROUNDS, onClick: updateRoundFilter, close: true };
  const roundOptions = [allRounds].concat(
    roundNames.map((roundName) => ({
      onClick: () => updateRoundFilter(roundName),
      label: roundName,
      close: true
    }))
  );

  const updateTables = () => updateUnscheduledTable() && updateScheduleTable();
  const scheduleClear = (e) => clearSchedule({ scheduledDate, target: e?.target, callback: updateTables });

  // SEARCH filter
  let searchText;
  const searchFilter = (rowData) => rowData.searchText?.includes(searchText);
  const updateSearchFilter = (value) => {
    if (!value) table.removeFilter(searchFilter);
    searchText = value;
    if (value) table.addFilter(searchFilter);
  };

  const autoScheduler = () =>
    autoScheduleMatchUps({ scheduledDate, table, updateScheduleTable, updateUnscheduledTable });

  const items = [
    {
      onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateSearchFilter(''),
      onChange: (e) => updateSearchFilter(e.target.value),
      onKeyUp: (e) => updateSearchFilter(e.target.value),
      placeholder: 'Search participants',
      location: LEFT,
      search: true
    },
    {
      hide: eventOptions.length < 2,
      options: eventOptions,
      id: 'eventOptions',
      label: ALL_EVENTS,
      modifyLabel: true,
      location: LEFT,
      selection: true
    },
    {
      hide: roundOptions.length < 2,
      options: roundOptions,
      id: 'roundOptions',
      label: ALL_ROUNDS,
      modifyLabel: true,
      location: LEFT,
      selection: true
    },
    {
      label: 'Clear schedule',
      onClick: scheduleClear,
      intent: 'is-warning',
      id: 'clearSchedule'
    },
    {
      onClick: autoScheduler,
      label: 'Auto schedule',
      intent: 'is-primary',
      id: 'autoSchedule'
    },
    {
      onClick: toggleUnscheduled,
      id: 'doneScheduling',
      intent: 'is-info',
      label: 'Done'
    }
  ];

  controlBar({ target: controlAnchor, items }).elements;
}
