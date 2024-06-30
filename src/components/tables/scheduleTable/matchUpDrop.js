import { mapMatchUp } from 'pages/tournament/tabs/matchUpsTab/mapMatchUp';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { updateConflicts } from './updateConflicts';
import { isObject } from 'functions/typeOf';
import { context } from 'services/context';

import { COMPETITION_ENGINE, UNSCHEDULED_MATCHUPS } from 'constants/tmxConstants';
import { ADD_MATCHUP_SCHEDULE_ITEMS } from 'constants/mutationConstants';

export async function matchUpDrop(ev, cell) {
  ev.preventDefault();
  const sourceMatchUpId = ev.dataTransfer.getData('itemid');
  const methods = [];

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

  const selectedDate = context.displayed.selectedScheduleDate;

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

  const invokeMethods = () => {
    const callback = (result) => {
      !result.success && console.log({ result });
      updateConflicts(table);
    };
    mutationRequest({ methods, engine: COMPETITION_ENGINE, callback });
  };

  const updateSourceMatchUp = ({ scheduledTime = '', timeModifiers = [] } = {}) => {
    const updatedSourceSchedule = {
      courtOrder: targetCourtOrder,
      scheduledDate: selectedDate,
      venueId: targetVenueId,
      courtId: targetCourtId,
      scheduledTime,
      timeModifiers,
    };

    methods.push({
      method: ADD_MATCHUP_SCHEDULE_ITEMS,
      params: {
        tournamentId: sourceMatchUp?.tournamentId,
        matchUpId: sourceMatchUp?.matchUpId,
        schedule: updatedSourceSchedule,
        drawId: sourceMatchUp?.drawId,
        removePriorValues: true,
      },
    });

    // update the source data for future re-renders
    sourceMatchUp.schedule = updatedSourceSchedule;
  };

  const updatedTargetSchedule = {
    scheduledDate: sourceSchedule?.scheduledDate,
    scheduledTime: sourceSchedule?.scheduledTime,
    timeModifiers: sourceSchedule?.timeModifiers,
    courtOrder: sourceCourtOrder,
    venueId: sourceVenueId,
    courtId: sourceCourtId,
  };

  const updateTargetMatchUp = () => {
    methods.push({
      method: ADD_MATCHUP_SCHEDULE_ITEMS,
      params: {
        tournamentId: targetMatchUp?.tournamentId,
        matchUpId: targetMatchUp?.matchUpId,
        schedule: updatedTargetSchedule,
        drawId: targetMatchUp?.drawId,
        removePriorValues: true,
      },
    });

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
          courtId: sourceCourtId,
        },
      };

      if (sourceRow.rowId == targetRow.rowId) {
        sourceRow[targetColumnKey] = sourceMatchUp;
        table.updateData([sourceRow]); // to only update the specific row which have been affected
      } else {
        targetRow[targetColumnKey] = sourceMatchUp;
        table.updateData([sourceRow, targetRow]); // to only update the specific rows which have been affected
      }
    }
  } else if (!sourceRow && targetMatchUp) {
    console.log('sourceRow missing and targetMatchUp');
    const unscheduledTable = Tabulator.findTable(`#${UNSCHEDULED_MATCHUPS}`)[0];
    unscheduledTable.deleteRow(sourceMatchUpId);
    updateSourceMatchUp();

    targetRow[targetColumnKey] = sourceMatchUp;
    table.updateData([targetRow]); // to only update the specific rows which have been affected

    unscheduledTable.addRow(mapMatchUp(targetMatchUp), true);
    updateTargetMatchUp();
  } else {
    console.log('matchUps swapping schedule');
    // matchUps are swapping schedule
    const targetSchedule = targetMatchUp?.schedule;
    updateSourceMatchUp({
      scheduledTime: targetSchedule?.scheduledTime,
      timeModifiers: targetSchedule?.timeModifiers,
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

  invokeMethods();
}
