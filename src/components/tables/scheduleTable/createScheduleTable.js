import { competitionEngine, tools } from 'tods-competition-factory';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'pages/tournament/destroyTable';
import { getScheduleColumns } from './getScheduleColumns';
import { updateConflicts } from './updateConflicts';

import { TOURNAMENT_SCHEDULE } from 'constants/tmxConstants';

export function createScheduleTable({ scheduledDate } = {}) {
  let ready, table, awaitingUpdate;
  let existingCourtIds = [];

  const getTableData = ({ scheduledDate }) => {
    const matchUpFilters = { localPerspective: true, scheduledDate };
    const result = competitionEngine.competitionScheduleMatchUps({
      courtCompletedMatchUps: true,
      withCourtGridRows: true,
      minCourtGridRows: 10,
      nextMatchUps: true,
      matchUpFilters,
    });
    const { dateMatchUps = [], completedMatchUps = [], courtsData, courtPrefix = 'C|', rows, groupInfo } = result;
    const matchUps = dateMatchUps.concat(...completedMatchUps);

    const columns = getScheduleColumns({ courtsData, courtPrefix });

    rows.forEach((row, i) => {
      row.rowId = `rowId-${i + 1}`;
      row.rowNumber = i + 1;
    });
    return { rows, columns, matchUps, courtsCount: courtsData.length, courtsData, groupInfo };
  };

  const replaceTableData = ({ scheduledDate } = {}) => {
    const refresh = () => {
      const { rows, matchUps, columns, courtsData } = getTableData({ scheduledDate });
      const courtIds = courtsData?.map((court) => court.courtId);

      const equivalentCourts = tools.intersection(existingCourtIds, courtIds).length === courtIds?.length;

      if (!equivalentCourts) {
        table.setColumns(columns);
        existingCourtIds = courtIds;
      }
      awaitingUpdate = true;
      table?.replaceData(rows);
      table.matchUps = matchUps;
    };

    setTimeout(refresh, ready ? 0 : 1000);
  };

  destroyTable({ anchorId: TOURNAMENT_SCHEDULE });
  const element = document.getElementById(TOURNAMENT_SCHEDULE);

  const { rows = [], columns = [], courtsCount } = getTableData({ scheduledDate });
  existingCourtIds = columns.map(({ courtId }) => courtId).filter(Boolean);

  table = new Tabulator(element, {
    height: window.innerHeight * 0.84,
    renderHorizontal: 'virtual',
    placeholder: 'No courts',
    index: 'rowId',
    data: rows,
    columns,
  });

  table.on('scrollVertical', destroyTipster);
  table.on('tableBuilt', () => {
    updateConflicts(table);
    ready = true;
  });
  table.on('dataProcessed', () => {
    if (awaitingUpdate) {
      awaitingUpdate = false;
      updateConflicts(table);
    }
  });

  return { table, replaceTableData, courtsCount };
}
