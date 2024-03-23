import { createUnscheduledTable } from 'components/tables/unscheduledTable/createUnscheduledTable';
import { createScheduleTable } from 'components/tables/scheduleTable/createScheduleTable';
import { unscheduledGridControl } from './unscheduledGridControl';
import { competitionEngine } from 'tods-competition-factory';
import { scheduleGridControl } from './scheduleGridControl';
import { context } from 'services/context';

import { NONE, SCHEDULE_CONTROL, UNSCHEDULED_CONTROL, UNSCHEDULED_VISIBILITY } from 'constants/tmxConstants';

export function renderScheduleTab({ scheduledDate }) {
  let gridControlElements;

  const unscheduledVisibility = document.getElementById(UNSCHEDULED_VISIBILITY);
  const unscheduldControlAnchor = document.getElementById(UNSCHEDULED_CONTROL);
  const controlAnchor = document.getElementById(SCHEDULE_CONTROL);
  unscheduldControlAnchor.style.paddingBottom = '1em';
  controlAnchor.style.paddingBottom = '1em';

  let schedulingActive = context.state.schedulingActive;
  unscheduledVisibility.style.display = schedulingActive ? '' : NONE;

  scheduledDate = scheduledDate || competitionEngine.getCompetitionDateRange().startDate;
  const {
    replaceTableData: updateUnscheduledTable,
    table: unscheduledTable,
    unscheduledMatchUps,
  } = createUnscheduledTable({ scheduledDate });

  const toggleUnscheduled = () => {
    schedulingActive = !schedulingActive;
    context.state.schedulingActive = schedulingActive;
    unscheduledVisibility.style.display = schedulingActive ? '' : NONE;

    if (gridControlElements?.scheduleMatchUps)
      gridControlElements.scheduleMatchUps.style.display = schedulingActive ? NONE : '';
  };

  const {
    replaceTableData: updateScheduleTable,
    table: scheduleTable,
    courtsCount,
  } = createScheduleTable({
    scheduledDate,
  });

  const { updateScheduledDate } = unscheduledGridControl({
    controlAnchor: unscheduldControlAnchor,
    matchUps: unscheduledMatchUps,
    table: unscheduledTable,
    updateUnscheduledTable,
    updateScheduleTable,
    toggleUnscheduled,
    scheduledDate,
  });

  const setDate = (scheduledDate) => {
    context.displayed.schedule_day = scheduledDate;
    updateUnscheduledTable({ scheduledDate });
    updateScheduleTable({ scheduledDate });
    if (updateScheduledDate) updateScheduledDate(scheduledDate);
  };
  gridControlElements = scheduleGridControl({
    table: scheduleTable,
    unscheduledMatchUps,
    updateScheduleTable,
    toggleUnscheduled,
    schedulingActive,
    controlAnchor,
    scheduledDate,
    courtsCount,
    setDate,
  }).elements;
}
