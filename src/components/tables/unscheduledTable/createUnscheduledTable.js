import { competitionEngine, factoryConstants, genderConstants } from 'tods-competition-factory';
import { mapMatchUp } from 'Pages/Tournament/Tabs/matchUpsTab/mapMatchUp';
import { matchUpDragStart } from '../scheduleTable/matchUpDragStart';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'Pages/Tournament/destroyTable';
import { matchUpReturn } from './matchUpReturn';
import { isObject } from 'functions/typeOf';

import { CENTER, UNSCHEDULED_MATCHUPS } from 'constants/tmxConstants';
const { MALE, FEMALE } = genderConstants;

export function createUnscheduledTable() {
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

  function genderedParticipant(cell) {
    const elem = document.createElement('div');
    const value = cell.getValue();
    const color = (isObject(value) && value?.sex === MALE && '#2E86C1') || (value?.sex === FEMALE && '#AA336A') || '';
    elem.style.color = color;
    elem.innerHTML = (isObject(value) ? value.participantName : value) || '';
    return elem;
  }

  function formatCell(cell) {
    const element = document.createElement('div');
    element.innerHTML = cell.getValue();
    return element;
  }

  function getTableData() {
    unscheduledMatchUps =
      competitionEngine
        .allCompetitionMatchUps({
          matchUpFilters: { matchUpStatuses: factoryConstants.upcomingMatchUpStatuses },
          nextMatchUps: true
        })
        .matchUps?.filter((m) => !m.schedule?.courtId && !m.sides?.some(({ bye }) => bye)) || [];

    const rowMatchUps = unscheduledMatchUps.map(mapMatchUp);
    return { rowMatchUps };
  }

  function replaceTableData() {
    const refresh = () => {
      const { rowMatchUps = [] } = getTableData();
      if (table) {
        table.replaceData(rowMatchUps);
      }
    };

    setTimeout(refresh, ready ? 0 : 1000);

    return { unscheduledMatchUps };
  }

  function titleFormatter(cell) {
    const elem = cell.getElement();
    elem.classList.add('tag');
    elem.classList.add('is-info');
    elem.classList.add('is-light');
    return unscheduledMatchUps.length;
  }

  const columns = [
    {
      titleFormatter,
      formatter: 'rownum', // format this to show open/close caret
      headerSort: false,
      hozAlign: CENTER,
      frozen: true,
      width: 55
    },
    {
      formatter: formatCell,
      field: 'eventName',
      resizable: false,
      title: 'Event',
      visible: true,
      minWidth: 250
    },
    {
      formatter: formatCell,
      field: 'roundName',
      resizable: false,
      title: 'Round',
      minWidth: 90
    },
    {
      formatter: genderedParticipant,
      responsive: false,
      resizable: false,
      title: 'Side 1',
      minWidth: 120,
      field: 'side1'
    },
    {
      formatter: genderedParticipant,
      responsive: false,
      resizable: false,
      title: 'Side 2',
      minWidth: 120,
      field: 'side2'
    },
    {
      field: 'matchUp.matchUpFormat',
      title: 'Scoring Format',
      formatter: formatCell,
      responsive: false,
      resizable: false,
      minWidth: 100
      /*
    },
    {
      // field: 'matchUp.matchUpFormat',
      title: 'Average Time',
      formatter: formatCell,
      responsive: false,
      resizable: false,
      minWidth: 100
    */
    }
  ];

  destroyTable({ anchorId: UNSCHEDULED_MATCHUPS });
  const unscheduledAnchor = document.getElementById(UNSCHEDULED_MATCHUPS);
  const { rowMatchUps = [] } = getTableData();

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
