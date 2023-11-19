import { scheduleSetMatchUpHeader } from 'components/popovers/scheduleSetMatchUpHeader';
import { setScheduleColumnHeader } from 'components/popovers/scheduleColumnHeader';
import { scheduleCell } from '../common/formatters/scheduleCell';
import { generateEmptyColumns } from './generateEmptyColumns';
import { tournamentEngine } from 'tods-competition-factory';
import { getControlColumn } from './getControlColumn';

import { CENTER, MINIMUM_SCHEDULE_COLUMNS } from 'constants/tmxConstants';

export function getScheduleColumns({ courtsData, courtPrefix }) {
  const scheduleCellActions = (e, cell) => {
    const field = cell.getColumn().getDefinition().field;
    const { drawId, matchUpId } = cell.getData()[field];
    const callback = () => {
      // nextMatchUps not currently supported by `findDrawMatchUp` (called by te.findMatchUp)
      // const matchUp = tournamentEngine.findMatchUp({ drawId, matchUpId, nextMatchUps: true })?.matchUp;
      const matchUp = tournamentEngine.allTournamentMatchUps({
        matchUpFilters: { drawIds: [drawId], matchUpIds: [matchUpId] },
        nextMatchUps: true
      })?.matchUps?.[0];
      const targetRow = cell.getRow().getData();
      targetRow[field] = matchUp;
      const table = cell.getTable();
      table.updateData([targetRow]); // to only update the specific rows which have been affected
    };
    scheduleSetMatchUpHeader({ e, cell, matchUpId, callback });
  };

  const columnsCalc = MINIMUM_SCHEDULE_COLUMNS - courtsData.length;
  const emptyColumnsCount = columnsCalc <= 0 ? 1 : columnsCalc;

  const emptyColumns = generateEmptyColumns({ courtsData, count: emptyColumnsCount });
  const controlColumn = getControlColumn();

  const generateColumn = (courtInfo, index) => ({
    headerClick: (e, cell) => setScheduleColumnHeader(e, cell, courtInfo),
    cellClick: scheduleCellActions,
    field: `${courtPrefix}${index}`,
    title: courtInfo.courtName,
    headerHozAlign: CENTER,
    formatter: scheduleCell,
    headerSort: false,
    resizable: false,
    hozAlign: CENTER,
    minWidth: 150
  });

  return [controlColumn].concat(courtsData.map(generateColumn), emptyColumns);
}
