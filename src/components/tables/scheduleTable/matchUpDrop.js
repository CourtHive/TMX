import { mapMatchUp } from 'Pages/Tournament/Tabs/matchUpsTab/mapMatchUp';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { updateConflicts } from './updateConflicts';
import { isObject } from 'functions/typeOf';

import { COMPETITION_ENGINE, SCHEDULED_DATE_FILTER, UNSCHEDULED_MATCHUPS } from 'constants/tmxConstants';
import { ADD_MATCHUP_SCHEDULE_ITEMS } from 'constants/mutationConstants';

export function matchUpDrop(ev, cell) {
  ev.preventDefault();
  const sourceMatchUpId = ev.dataTransfer.getData('itemid');

  const table = cell.getTable();
  const data = table.getData();
  const targetRow = cell.getRow().getData();

  let matchUps = table.getData().flatMap((row) => Object.values(row).filter((m) => m.matchUpId));
  let sourceMatchUp = matchUps.find((matchUp) => matchUp.matchUpId === sourceMatchUpId);
  if (!sourceMatchUp) {
    const unscheduledTable = Tabulator.findTable(`#${UNSCHEDULED_MATCHUPS}`)[0];
    const unscheduledMatchUps = unscheduledTable.getData().map((row) => row.matchUp);
    sourceMatchUp = unscheduledMatchUps.find((matchUp) => matchUp.matchUpId === sourceMatchUpId) || {};
  }

  const selectedDate = document.getElementById(SCHEDULED_DATE_FILTER).value;

  const { courtOrder: sourceCourtOrder, courtId: sourceCourtId, venueId: sourceVenueId } = sourceMatchUp.schedule || {};

  const target = ev.currentTarget;
  const targetMatchUpId = target.id;

  // CASE: dropped onto origin cell
  if (sourceMatchUpId === targetMatchUpId) {
    return;
  }

  const sourceSchedule = sourceMatchUp.schedule;
  const targetMatchUp = targetMatchUpId && matchUps.find((matchUp) => matchUp.matchUpId === targetMatchUpId);

  const targetVenueId = target.getAttribute('venueId');
  const targetCourtId = target.getAttribute('courtId');
  const targetCourtOrder = target.getAttribute('courtOrder');

  const targetColumnKey = Object.keys(targetRow).find((key) => {
    if (!isObject(targetRow[key])) return;
    const schedule = targetRow[key]?.schedule || {};
    const { courtOrder, courtId, venueId } = schedule;
    return (
      courtOrder?.toString() === targetCourtOrder.toString() && venueId === targetVenueId && courtId === targetCourtId
    );
  });

  let sourceColumnKey;
  const sourceRow = data.find((row) => {
    sourceColumnKey = Object.keys(row).find((key) => {
      if (!isObject(row[key])) return;
      const schedule = row[key]?.schedule || {};
      const { courtOrder, courtId, venueId } = schedule;
      return courtOrder === sourceCourtOrder && venueId === sourceVenueId && courtId === sourceCourtId;
    });
    return sourceColumnKey;
  });

  const updateSourceMatchUp = ({ scheduledTime = '', timeModifiers = [] } = {}) => {
    const updatedSourceSchedule = {
      courtOrder: targetCourtOrder,
      scheduledDate: selectedDate,
      venueId: targetVenueId,
      courtId: targetCourtId,
      scheduledTime,
      timeModifiers
    };

    const methods = [
      {
        method: ADD_MATCHUP_SCHEDULE_ITEMS,
        params: {
          tournamentId: sourceMatchUp?.tournamentId,
          matchUpId: sourceMatchUp?.matchUpId,
          schedule: updatedSourceSchedule,
          drawId: sourceMatchUp?.drawId
        }
      }
    ];
    const callback = (result) => !result.success && console.log({ result });
    mutationRequest({ methods, engine: COMPETITION_ENGINE, callback });

    // update the source data for future re-renders
    sourceMatchUp.schedule = updatedSourceSchedule;
  };

  const updatedTargetSchedule = {
    scheduledDate: sourceSchedule?.scheduledDate,
    scheduledTime: sourceSchedule?.scheduledTime,
    timeModifiers: sourceSchedule?.timeModifiers,
    courtOrder: sourceCourtOrder,
    venueId: sourceVenueId,
    courtId: sourceCourtId
  };

  const updateTargetMatchUp = () => {
    const methods = [
      {
        method: ADD_MATCHUP_SCHEDULE_ITEMS,
        params: {
          tournamentId: targetMatchUp?.tournamentId,
          matchUpId: targetMatchUp?.matchUpId,
          schedule: updatedTargetSchedule,
          drawId: targetMatchUp?.drawId
        }
      }
    ];
    const callback = (result) => !result.success && console.log({ result });
    mutationRequest({ methods, engine: COMPETITION_ENGINE, callback });

    if (targetMatchUp) {
      targetMatchUp.schedule = updatedTargetSchedule;
    } else {
      console.log('missing targetMatchUp');
    }
  };

  // CASE: dropped onto an empty cell
  if (targetMatchUpId === '') {
    // CASE: dragged from unscheduled
    if (!sourceRow) {
      const unscheduledTable = Tabulator.findTable(`#${UNSCHEDULED_MATCHUPS}`)[0];
      unscheduledTable.deleteRow(sourceMatchUpId);
      updateSourceMatchUp();

      targetRow[targetColumnKey] = sourceMatchUp;
      table.updateData([targetRow]); // to only update the specific rows which have been affected
    } else {
      updateSourceMatchUp();

      // update cell of source row by removing all matchUp detail
      sourceRow[sourceColumnKey] = {
        schedule: {
          courtOrder: sourceCourtOrder,
          venueId: sourceVenueId,
          courtId: sourceCourtId
        }
      };

      if (sourceRow.rowId == targetRow.rowId) {
        sourceRow[targetColumnKey] = sourceMatchUp;
        table.updateData([sourceRow]); // to only update the specific row which have been affected
      } else {
        targetRow[targetColumnKey] = sourceMatchUp;
        table.updateData([sourceRow, targetRow]); // to only update the specific rows which have been affected
      }
    }
  } else {
    if (!sourceRow && targetMatchUp) {
      const unscheduledTable = Tabulator.findTable(`#${UNSCHEDULED_MATCHUPS}`)[0];
      unscheduledTable.deleteRow(sourceMatchUpId);
      updateSourceMatchUp();

      targetRow[targetColumnKey] = sourceMatchUp;
      table.updateData([targetRow]); // to only update the specific rows which have been affected

      unscheduledTable.addRow(mapMatchUp(targetMatchUp), true);
      updateTargetMatchUp();
    } else {
      // matchUps are swapping schedule
      const targetSchedule = targetMatchUp?.schedule;
      updateSourceMatchUp({
        scheduledTime: targetSchedule?.scheduledTime,
        timeModifiers: targetSchedule?.timeModifiers
      });

      updateTargetMatchUp();

      if (sourceRow.rowId == targetRow.rowId) {
        sourceRow[sourceColumnKey] = targetMatchUp;
        sourceRow[targetColumnKey] = sourceMatchUp;
        table.updateData([sourceRow]); // to only update the specific row which have been affected
      } else {
        sourceRow[sourceColumnKey] = targetMatchUp;
        targetRow[targetColumnKey] = sourceMatchUp;
        table.updateData([sourceRow, targetRow]); // to only update the specific rows which have been affected
      }
    }
  }

  updateConflicts(table);
}
