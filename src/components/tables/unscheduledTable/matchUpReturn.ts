import { mapMatchUp } from 'pages/tournament/tabs/matchUpsTab/mapMatchUp';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { updateConflicts } from '../scheduleTable/updateConflicts';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { isObject } from 'functions/typeOf';

import { ADD_MATCHUP_SCHEDULE_ITEMS } from 'constants/mutationConstants';
import { COMPETITION_ENGINE } from 'constants/tmxConstants';

export function matchUpReturn(ev: DragEvent, table: any): void {
  ev.preventDefault();
  const sourceMatchUpId = ev.dataTransfer?.getData('itemid');
  const scheduleTable = Tabulator.findTable('#tournamentSchedule')[0];
  const scheduledMatchUps = scheduleTable.getData().flatMap((row: any) => Object.values(row).filter((v: any) => v && typeof v === 'object' && 'matchUpId' in v));
  const sourceMatchUp = scheduledMatchUps.find((matchUp: any) => matchUp.matchUpId === sourceMatchUpId) || {};
  if (!sourceMatchUp?.schedule?.courtId) return;

  let sourceColumnKey: string | undefined;
  const sourceRow = scheduleTable.getData().find((row: any) => {
    sourceColumnKey = Object.keys(row).find((key) => {
      if (!isObject(row[key])) return;
      return (row[key] as any).matchUpId === sourceMatchUpId;
    });
    return sourceColumnKey;
  });
  const { courtId, courtOrder, venueId } = sourceMatchUp.schedule;

  if (sourceRow && sourceColumnKey) {
    sourceRow[sourceColumnKey] = {
      schedule: {
        courtOrder,
        courtId,
        venueId,
      },
    };
    scheduleTable.updateData([sourceRow]);
  }

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
        drawId: sourceMatchUp.drawId,
        removePriorValues: true,
      },
    },
  ];
  const callback = (result: any) => !result.success && console.log({ result });
  mutationRequest({ methods, engine: COMPETITION_ENGINE, callback });

  sourceMatchUp.schedule = updatedSourceSchedule;

  const newRow = mapMatchUp(sourceMatchUp);
  table.addRow(newRow, true);

  updateConflicts(scheduleTable);
}
