import { setScheduleColumnHeader } from 'components/popovers/scheduleColumnHeader';
import { scheduleCell } from '../common/formatters/scheduleCell';
import { generateEmptyColumns } from './generateEmptyColumns';
import { getControlColumn } from './getControlColumn';

import { CENTER, MINIMUM_SCHEDULE_COLUMNS } from 'constants/tmxConstants';

export function getScheduleColumns({ courtsData, courtPrefix }) {
  const scheduleCellActions = (e, cell) => {
    console.log(cell.getData()[cell.getColumn().getDefinition().field]);
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
