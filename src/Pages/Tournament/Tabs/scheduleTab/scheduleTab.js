import { createUnscheduledTable } from 'components/tables/unscheduledTable/createUnscheduledTable';
import { createScheduleTable } from 'components/tables/scheduleTable/createScheduleTable';
import { unscheduledGridControl } from './unscheduledGridControl';
import { competitionEngine } from 'tods-competition-factory';
import { scheduleGridControl } from './scheduleGridControl';
import { context } from 'services/context';

import { NONE, SCHEDULE_CONTROL, UNSCHEDULED_CONTROL, UNSCHEDULED_VISIBILITY } from 'constants/tmxConstants';

export function renderScheduleTab() {
  let gridControlElements;

  const unscheduledVisibility = document.getElementById(UNSCHEDULED_VISIBILITY);
  const unscheduldControlAnchor = document.getElementById(UNSCHEDULED_CONTROL);
  const controlAnchor = document.getElementById(SCHEDULE_CONTROL);
  unscheduldControlAnchor.style.paddingBottom = '1em';
  controlAnchor.style.paddingBottom = '1em';

  let schedulingActive = context.state.schedulingActive;
  unscheduledVisibility.style.display = schedulingActive ? '' : NONE;

  const {
    replaceTableData: updateUnscheduledTable,
    table: unscheduledTable,
    unscheduledMatchUps
  } = createUnscheduledTable();

  const toggleUnscheduled = () => {
    unscheduledVisibility.style.display = schedulingActive ? NONE : '';
    schedulingActive = !schedulingActive;
    context.state.schedulingActive = schedulingActive;

    if (gridControlElements?.scheduleMatchUps)
      gridControlElements.scheduleMatchUps.style.display = schedulingActive ? NONE : '';
  };

  const scheduledDate = competitionEngine.getCompetitionDateRange().startDate;
  const {
    replaceTableData: updateScheduleTable,
    table: scheduleTable,
    courtsCount
  } = createScheduleTable({
    scheduledDate
  });

  unscheduledGridControl({
    controlAnchor: unscheduldControlAnchor,
    matchUps: unscheduledMatchUps,
    table: unscheduledTable,
    updateUnscheduledTable,
    updateScheduleTable,
    toggleUnscheduled,
    scheduledDate
  });

  const setDate = (scheduledDate) => {
    updateScheduleTable({ scheduledDate });
    context.displayed.schedule_day = scheduledDate;
  };
  gridControlElements = scheduleGridControl({
    table: scheduleTable,
    updateScheduleTable,
    toggleUnscheduled,
    schedulingActive,
    controlAnchor,
    scheduledDate,
    courtsCount,
    setDate
  }).elements;
}
