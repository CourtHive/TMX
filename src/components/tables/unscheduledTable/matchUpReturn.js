import { mapMatchUp } from 'pages/Tournament/Tabs/matchUpsTab/mapMatchUp';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { updateConflicts } from '../scheduleTable/updateConflicts';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { isObject } from 'functions/typeOf';

import { ADD_MATCHUP_SCHEDULE_ITEMS } from 'constants/mutationConstants';
import { COMPETITION_ENGINE } from 'constants/tmxConstants';

export function matchUpReturn(ev, table) {
  ev.preventDefault();
  const sourceMatchUpId = ev.dataTransfer.getData('itemid');
  const scheduleTable = Tabulator.findTable('#tournamentSchedule')[0];
  const scheduledMatchUps = scheduleTable.getData().flatMap((row) => Object.values(row).filter((v) => v.matchUpId));
  const sourceMatchUp = scheduledMatchUps.find((matchUp) => matchUp.matchUpId === sourceMatchUpId) || {};
  if (!sourceMatchUp?.schedule?.courtId) return;

  let sourceColumnKey;
  const sourceRow = scheduleTable.getData().find((row) => {
    sourceColumnKey = Object.keys(row).find((key) => {
      if (!isObject(row[key])) return;
      return row[key].matchUpId === sourceMatchUpId;
    });
    return sourceColumnKey;
  });
  const { courtId, courtOrder, venueId } = sourceMatchUp.schedule;

  sourceRow[sourceColumnKey] = {
    schedule: {
      courtOrder,
      courtId,
      venueId
    }
  };
  scheduleTable.updateData([sourceRow]);

  delete sourceMatchUp.schedule.scheduledDate;
  delete sourceMatchUp.schedule.scheduledTime;
  delete sourceMatchUp.schedule.courtOrder;
  delete sourceMatchUp.schedule.courtId;
  delete sourceMatchUp.schedule.venueId;

  const updatedSourceSchedule = { scheduledTime: '', scheduledDate: '', courtOrder: '', venueId: '', courtId: '' };
  const methods = [
    {
      method: ADD_MATCHUP_SCHEDULE_ITEMS,
      params: {
        tournamentId: sourceMatchUp.tournamentId,
        matchUpId: sourceMatchUp.matchUpId,
        schedule: updatedSourceSchedule,
        drawId: sourceMatchUp.drawId
      }
    }
  ];
  const callback = (result) => !result.success && console.log({ result });
  mutationRequest({ methods, engine: COMPETITION_ENGINE, callback });

  // update the source data for future re-renders
  sourceMatchUp.schedule = updatedSourceSchedule;

  // transform and add new row at the top of the table;
  // NOTE: do not add if matchUp is COMPLETED (see matchUpStatuses filters)
  const newRow = mapMatchUp(sourceMatchUp);
  table.addRow(newRow, true);

  updateConflicts(scheduleTable);
}
