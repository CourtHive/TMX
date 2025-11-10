/**
 * Create table for unscheduled matchUps.
 * Displays matches without court assignments with drag-and-drop functionality.
 */
import { competitionEngine, factoryConstants, eventConstants } from 'tods-competition-factory';
import { mapMatchUp } from 'pages/tournament/tabs/matchUpsTab/mapMatchUp';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { matchUpDragStart } from '../scheduleTable/matchUpDragStart';
import { getUnscheduledColumns } from './getUnscheduledColumns';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'pages/tournament/destroyTable';
import { matchUpReturn } from './matchUpReturn';

import { UNSCHEDULED_MATCHUPS } from 'constants/tmxConstants';

const { SINGLES, DOUBLES } = eventConstants;

export function createUnscheduledTable({ scheduledDate: specifiedDate }: { scheduledDate?: string } = {}): { table: any; replaceTableData: (params?: { scheduledDate?: string }) => { unscheduledMatchUps: any[] }; unscheduledMatchUps: any[] } {
  const scheduledDate = specifiedDate;
  let unscheduledMatchUps: any[] = [];
  let ready: boolean;
  let table: any;

  function initDragDrop(row: any) {
    const element = row.getElement();
    const matchUp = row.getData().matchUp;
    const matchUpId = matchUp.matchUpId;
    element.id = matchUpId;
    element.addEventListener('dragstart', (e) => matchUpDragStart(e, true));
    element.draggable = true;
  }

  function getTableData({ scheduledDate: specifiedDate }: { scheduledDate?: string }) {
    const matchUpsWithNoCourt =
      competitionEngine
        .allCompetitionMatchUps({
          matchUpFilters: {
            matchUpStatuses: factoryConstants.upcomingMatchUpStatuses,
            matchUpTypes: [SINGLES, DOUBLES],
          },
          nextMatchUps: true,
        })
        .matchUps?.filter((m: any) => !m.schedule?.courtId && !m.sides?.some(({ bye }: any) => bye)) || [];

    const filterDate = specifiedDate || scheduledDate;
    unscheduledMatchUps = matchUpsWithNoCourt.filter(
      (m: any) => !m.schedule?.scheduledDate || m.schedule.scheduledDate === filterDate,
    );

    const rowMatchUps = unscheduledMatchUps.map(mapMatchUp);
    return { rowMatchUps };
  }

  function replaceTableData({ scheduledDate }: { scheduledDate?: string } = {}) {
    const refresh = () => {
      const { rowMatchUps = [] } = getTableData({ scheduledDate });
      if (table) {
        table.replaceData(rowMatchUps);
      }
    };

    setTimeout(refresh, ready ? 0 : 1000);

    return { unscheduledMatchUps };
  }

  const columns = getUnscheduledColumns(unscheduledMatchUps);

  destroyTable({ anchorId: UNSCHEDULED_MATCHUPS });
  const unscheduledAnchor = document.getElementById(UNSCHEDULED_MATCHUPS);
  const { rowMatchUps = [] } = getTableData({ scheduledDate });

  table = new Tabulator(unscheduledAnchor, {
    headerSortElement: headerSortElement(['flight']),
    placeholder: 'No unscheduled matches',
    rowFormatter: initDragDrop,
    layout: 'fitDataStretch',
    index: 'matchUpId',
    data: rowMatchUps,
    height: 250,
    columns,
  });

  table.on('tableBuilt', () => {
    ready = true;
    const tableHolder = unscheduledAnchor?.getElementsByClassName('tabulator-tableholder')[0] as HTMLElement;
    tableHolder.addEventListener('drop', (e) => matchUpReturn(e, table));
    tableHolder.ondragover = (e) => e.preventDefault();
    tableHolder.draggable = true;
  });
  table.on('dataChanged', (rows: any[]) => {
    const titleElement = table.getColumns()[0]._getSelf().titleElement;
    titleElement.innerHTML = `${rows.length}`;
  });
  table.on('dataFiltered', (_filters: any, rows: any[]) => {
    const titleElement = table.getColumns()[0]._getSelf().titleElement;
    titleElement.innerHTML = `${rows.length}`;
  });
  table.on('rowClick', (_e: Event, row: any) => {
    const matchUp = row.getData();
    console.log({ matchUp });
  });

  return { table, replaceTableData, unscheduledMatchUps };
}
