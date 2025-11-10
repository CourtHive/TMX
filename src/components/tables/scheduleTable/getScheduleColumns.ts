/**
 * Schedule table columns configuration.
 * Generates columns for courts with matchUp scheduling and click handlers.
 */
import { scheduleSetMatchUpHeader } from 'components/popovers/scheduleSetMatchUpHeader';
import { setScheduleColumnHeader } from 'components/popovers/scheduleColumnHeader';
import { scheduleCell } from '../common/formatters/scheduleCell';
import { generateEmptyColumns } from './generateEmptyColumns';
import { tournamentEngine } from 'tods-competition-factory';
import { getControlColumn } from './getControlColumn';

import { CENTER, MINIMUM_SCHEDULE_COLUMNS } from 'constants/tmxConstants';

export function getScheduleColumns({ courtsData, courtPrefix }: { courtsData: any[]; courtPrefix: string }): any[] {
  const scheduleCellActions = (e: any, cell: any) => {
    const field = cell.getColumn().getDefinition().field;
    const { drawId, matchUpId } = cell.getData()[field];
    const callback = () => {
      const matchUp = tournamentEngine.allTournamentMatchUps({
        matchUpFilters: { drawIds: [drawId], matchUpIds: [matchUpId] },
        nextMatchUps: true,
      })?.matchUps?.[0];
      const targetRow = cell.getRow().getData();
      targetRow[field] = matchUp;
      const table = cell.getTable();
      table.updateData([targetRow]);
    };
    scheduleSetMatchUpHeader({ e, cell, matchUpId, callback });
  };

  const columnsCalc = MINIMUM_SCHEDULE_COLUMNS - courtsData?.length || 0;
  const emptyColumnsCount = columnsCalc <= 0 ? 1 : columnsCalc;

  const emptyColumns = generateEmptyColumns({ courtsData, count: emptyColumnsCount });
  const controlColumn = getControlColumn();

  const generateColumn = (courtInfo: any, index: number) => ({
    headerClick: (e: any, cell: any) => setScheduleColumnHeader(e, cell, courtInfo),
    cellClick: scheduleCellActions,
    field: `${courtPrefix}${index}`,
    title: courtInfo.courtName,
    headerHozAlign: CENTER,
    formatter: scheduleCell,
    headerSort: false,
    resizable: false,
    hozAlign: CENTER,
    minWidth: 150,
  });

  return [controlColumn].concat(courtsData?.map(generateColumn), emptyColumns);
}
