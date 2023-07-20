import { competitionEngine, factoryConstants, eventConstants } from 'tods-competition-factory';
import { mapMatchUp } from 'Pages/Tournament/Tabs/matchUpsTab/mapMatchUp';
import { matchUpDragStart } from '../scheduleTable/matchUpDragStart';
import { getUnscheduledColumns } from './getUnscheduledColumns';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'Pages/Tournament/destroyTable';
import { matchUpReturn } from './matchUpReturn';

import { UNSCHEDULED_MATCHUPS } from 'constants/tmxConstants';

const { SINGLES, DOUBLES } = eventConstants;

export function createUnscheduledTable({ scheduledDate: specifiedDate } = {}) {
  let scheduledDate = specifiedDate;
  let unscheduledMatchUps;
  let ready, table;

  function initDragDrop(row) {
    const element = row.getElement();
    const matchUp = row.getData().matchUp;
    const matchUpId = matchUp.matchUpId;
    element.id = matchUpId;
    element.addEventListener('dragstart', (e) => matchUpDragStart(e, true));
    element.draggable = true;
  }

  function getTableData({ scheduledDate: specifiedDate }) {
    const matchUpsWithNoCourt =
      competitionEngine
        .allCompetitionMatchUps({
          matchUpFilters: {
            matchUpStatuses: factoryConstants.upcomingMatchUpStatuses,
            matchUpTypes: [SINGLES, DOUBLES]
          },
          nextMatchUps: true
        })
        .matchUps?.filter((m) => !m.schedule?.courtId && !m.sides?.some(({ bye }) => bye)) || [];

    const filterDate = specifiedDate || scheduledDate;
    unscheduledMatchUps = matchUpsWithNoCourt.filter(
      (m) => !m.schedule?.scheduledDate || m.schedule.scheduledDate === filterDate
    );

    const rowMatchUps = unscheduledMatchUps.map(mapMatchUp);
    return { rowMatchUps };
  }

  function replaceTableData({ scheduledDate } = {}) {
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
    placeholder: 'No unscheduled matches',
    rowFormatter: initDragDrop,
    layout: 'fitDataStretch',
    index: 'matchUpId',
    data: rowMatchUps,
    height: 250,
    columns
  });

  table.on('tableBuilt', () => {
    ready = true;
    const tableHolder = unscheduledAnchor.getElementsByClassName('tabulator-tableholder')[0];
    tableHolder.addEventListener('drop', (e) => matchUpReturn(e, table));
    tableHolder.ondragover = (e) => e.preventDefault();
    tableHolder.draggable = true;
  });
  table.on('dataChanged', (rows) => {
    const titleElement = table.getColumns()[0]._getSelf().titleElement;
    titleElement.innerHTML = `${rows.length}`;
  });
  table.on('dataFiltered', (filters, rows) => {
    const titleElement = table.getColumns()[0]._getSelf().titleElement;
    titleElement.innerHTML = `${rows.length}`;
  });
  table.on('rowClick', (e, row) => {
    const matchUp = row.getData();
    console.log({ matchUp });
  });

  return { table, replaceTableData, unscheduledMatchUps };
}
