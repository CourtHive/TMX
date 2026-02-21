/**
 * Create schedule table with court grid and time slots.
 * Displays scheduled matchUps across courts with conflict detection and updates.
 */
import { competitionEngine, tools } from 'tods-competition-factory';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'pages/tournament/destroyTable';
import { getScheduleColumns } from './getScheduleColumns';
import { updateConflicts } from './updateConflicts';
import { env } from 'settings/env';

// constants
import { TOURNAMENT_SCHEDULE } from 'constants/tmxConstants';

export function createScheduleTable({
  minCourtGridRows = 10,
  scheduledDate,
}: { scheduledDate?: string; minCourtGridRows?: number } = {}): {
  table: any;
  replaceTableData: (params?: any) => void;
  courtsCount: number;
} {
  let ready: boolean, table: any, awaitingUpdate: boolean;
  let existingCourtIds: string[] = [];
  let matchUps: any[] = [];

  const getTableData = ({ scheduledDate }: { scheduledDate?: string }) => {
    const matchUpFilters = { localPerspective: true, scheduledDate };
    const result = competitionEngine.competitionScheduleMatchUps({
      courtCompletedMatchUps: true,
      withCourtGridRows: true,
      nextMatchUps: true,
      minCourtGridRows,
      matchUpFilters,
    });
    const { dateMatchUps = [], completedMatchUps = [], courtsData, courtPrefix = 'C|', rows, groupInfo } = result;
    matchUps = dateMatchUps.concat(...completedMatchUps);

    const columns = getScheduleColumns({ courtsData, courtPrefix, updateScheduleTable: replaceTableData });

    rows?.forEach((row: any, i: number) => {
      row.rowId = `rowId-${i + 1}`;
      row.rowNumber = i + 1;
    });
    return { rows, columns, matchUps, courtsCount: courtsData?.length ?? 0, courtsData, groupInfo };
  };

  const replaceTableData = ({ scheduledDate }: { scheduledDate?: string } = {}) => {
    const refresh = () => {
      const { rows, matchUps, columns, courtsData } = getTableData({ scheduledDate });
      const courtIds = courtsData?.map((court: any) => court.courtId);

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
  const element = document.getElementById(TOURNAMENT_SCHEDULE)!;

  const { rows = [], columns = [], courtsCount } = getTableData({ scheduledDate });
  existingCourtIds = columns.map((col: any) => col?.courtId).filter(Boolean);

  table = new Tabulator(element, {
    height: window.innerHeight * (env.tableHeightMultiplier ?? 0.85),
    renderHorizontal: 'virtual',
    placeholder: 'No courts',
    index: 'rowId',
    data: rows,
    columns,
  });

  table.on('scrollVertical', destroyTipster);
  table.on('tableBuilt', () => {
    updateConflicts(table, matchUps);
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
