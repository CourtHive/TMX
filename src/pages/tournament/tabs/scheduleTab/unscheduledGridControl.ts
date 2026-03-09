/**
 * Unscheduled matchUps grid control bar.
 * Provides filtering (via filter popover), court targeting, search,
 * auto-scheduling, and schedule clearing functionality.
 */
import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { filterPopoverButton } from 'components/tables/common/filters/filterPopoverButton';
import { courtTargetButton } from 'components/tables/common/filters/courtTargetButton';
import {
  getScheduleEventFilter,
  getScheduleEventTypeFilter,
  getScheduleFlightFilter,
  getScheduleGenderFilter,
  getScheduleRoundFilter,
} from 'components/tables/common/filters/scheduleFilters';
import { autoScheduleMatchUps } from './autoScheduleMatchUps';
import { controlBar } from 'courthive-components';
import { findAncestor } from 'services/dom/parentAndChild';
import { clearSchedule } from './clearSchedule';
import { t } from 'i18n';

import { LEFT, RIGHT } from 'constants/tmxConstants';

export function unscheduledGridControl({
  updateUnscheduledTable,
  updateScheduleTable,
  toggleUnscheduled,
  minCourtGridRows,
  controlAnchor,
  scheduledDate,
  matchUps = [],
  table,
}: {
  updateUnscheduledTable: () => boolean;
  updateScheduleTable: (params: { scheduledDate: string }) => void;
  toggleUnscheduled: () => void;
  controlAnchor: HTMLElement;
  minCourtGridRows: number;
  scheduledDate: string;
  matchUps?: any[];
  table: any;
}): { updateScheduledDate: (date: string) => void } {
  let currentScheduledDate = scheduledDate;
  const updateScheduledDate = (date: string) => {
    currentScheduledDate = date;
  };

  // Build filter functions
  const { eventOptions, hasOptions: hasEvents, isFiltered: isEventFiltered } = getScheduleEventFilter(table);
  const { eventTypeOptions, hasOptions: hasEventTypes, isFiltered: isEventTypeFiltered } =
    getScheduleEventTypeFilter(table);
  const { genderOptions, hasOptions: hasGenders, isFiltered: isGenderFiltered } = getScheduleGenderFilter(table);
  const { roundOptions, hasOptions: hasRounds, isFiltered: isRoundFiltered } = getScheduleRoundFilter(table, matchUps);
  const { flightOptions, hasOptions: hasFlights, isFiltered: isFlightFiltered } = getScheduleFlightFilter(
    table,
    matchUps,
  );

  // Build filter popover sections
  const filterSections = [
    { label: t('pages.schedule.allEventTypes'), options: hasEventTypes ? eventTypeOptions : [], isFiltered: isEventTypeFiltered },
    { label: t('pages.schedule.allEvents'), options: hasEvents ? eventOptions : [], isFiltered: isEventFiltered },
    { label: t('pages.schedule.allFlights'), options: hasFlights ? flightOptions : [], isFiltered: isFlightFiltered },
    { label: t('pages.schedule.allGenders'), options: hasGenders ? genderOptions : [], isFiltered: isGenderFiltered },
    { label: t('pages.schedule.allRounds'), options: hasRounds ? roundOptions : [], isFiltered: isRoundFiltered },
  ];
  const { item: filterButton } = filterPopoverButton(filterSections);

  // Court target selector
  const { item: courtTarget, getSelectedCourtIds } = courtTargetButton();

  const updateTables = () => {
    if (updateUnscheduledTable()) {
      updateScheduleTable({ scheduledDate: currentScheduledDate });
    }
  };
  const scheduleClear = (e: Event) => {
    const result = findAncestor(e.target as HTMLElement, 'dropdown');
    clearSchedule({
      target: result || (e?.target as HTMLElement),
      scheduledDate: currentScheduledDate,
      callback: updateTables,
    });
  };

  const setSearchFilter = createSearchFilter(table);
  const autoScheduler = () =>
    autoScheduleMatchUps({
      scheduledDate: currentScheduledDate,
      getTargetCourtIds: getSelectedCourtIds,
      updateUnscheduledTable,
      updateScheduleTable,
      minCourtGridRows,
      table,
    });

  const actionOptions = [
    {
      onClick: autoScheduler,
      label: t('pages.schedule.autoSchedule'),
      intent: 'is-primary',
      id: 'autoSchedule',
      close: true,
    },
    {
      label: t('pages.schedule.clearSchedule'),
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
      placeholder: t('pages.schedule.searchParticipants'),
      location: LEFT,
      search: true,
    },
    filterButton,
    courtTarget,
    {
      options: actionOptions,
      label: t('pages.schedule.actions'),
      selection: false,
      location: RIGHT,
      align: RIGHT,
    },
    {
      onClick: toggleUnscheduled,
      id: 'doneScheduling',
      intent: 'is-info',
      label: t('pages.schedule.done'),
    },
  ];

  controlBar({ target: controlAnchor, items });
  return { updateScheduledDate };
}
