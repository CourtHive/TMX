import { scheduleSetMatchUpHeader } from 'components/modals/scheduleSetMatchUpHeader';
import { renderScheduleTab } from 'Pages/Tournament/Tabs/scheduleTab/scheduleTab';
import { setScheduleColumnHeader } from 'components/modals/scheduleColumnHeader';
import { competitionEngine, utilities } from 'tods-competition-factory';
import { addVenue } from 'Pages/Tournament/Tabs/venuesTab/addVenue';
import { scheduleCell } from '../common/formatters/scheduleCell';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'Pages/Tournament/destroyTable';
import { editNotes } from 'components/modals/scheduleNotes';
import { timeFormat } from 'functions/timeStrings';
import { updateConflicts } from './updateConflicts';

import { CENTER, MINIMUM_SCHEDULE_COLUMNS, TOURNAMENT_SCHEDULE } from 'constants/tmxConstants';

export function createScheduleTable({ scheduledDate } = {}) {
  let ready, table, awaitingUpdate;
  let existingCourtIds = [];

  const rowActions = (e, cell) => {
    const rowData = cell.getRow().getData();
    const matchUps = Object.values(rowData).filter((c) => c?.matchUpId);
    if (rowData.issues?.length) console.log({ issues: rowData.issues });

    if (matchUps.length) {
      const callback = (scheduledTime) => {
        if (scheduledTime) {
          const table = cell.getTable();
          const targetRow = table.getData().find((row) => row.rowId === rowData.rowId);
          Object.values(targetRow).forEach((c) => {
            if (c.matchUpId) c.schedule.scheduledTime = timeFormat(scheduledTime);
          });
          table.updateData([targetRow]);
        }
      };
      scheduleSetMatchUpHeader({ e, cell, rowData, callback });
    }
  };

  const scheduleCellActions = (e, cell) => {
    console.log(cell.getData()[cell.getColumn().getDefinition().field]);
  };

  const controlHeader = () => {
    editNotes({ notes: '', notice: '', callback: submitDetails });

    function submitDetails(result) {
      console.log({ result }); // what is the appropriate place for storage in TODS?
    }
  };

  function controlColumnFormatter(cell) {
    const content = document.createElement('span');
    const data = cell.getRow().getData();
    content.innerHTML = data.rowNumber;
    return content;
  }

  const getTableData = ({ scheduledDate }) => {
    const matchUpFilters = { localPerspective: true, scheduledDate };
    const result = competitionEngine.competitionScheduleMatchUps({
      courtCompletedMatchUps: true,
      withCourtGridRows: true,
      minCourtGridRows: 10,
      nextMatchUps: true,
      matchUpFilters
    });
    const { dateMatchUps = [], completedMatchUps = [], courtsData, courtPrefix = 'C|', rows } = result;
    const matchUps = dateMatchUps.concat(...completedMatchUps);

    function titleFormatter(cell) {
      const elem = cell.getElement();
      elem.classList.add('tag');
      elem.classList.add('is-info');
      elem.classList.add('is-light');
      return `<i class="fa-regular fa-note-sticky"></i>`;
    }

    const controlColumn = {
      titleFormatter,
      formatter: controlColumnFormatter,
      headerClick: controlHeader,
      cellClick: rowActions,
      headerSort: false,
      resizable: false,
      hozAlign: CENTER,
      frozen: true,
      width: 55
    };

    const columnsCalc = MINIMUM_SCHEDULE_COLUMNS - courtsData.length;
    const emptyColumnsCount = columnsCalc <= 0 ? 1 : columnsCalc;
    const emptyColumnHeaderClick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      addVenue(renderScheduleTab);
    };
    const emptyColumnHeader = (index) => {
      if (index) return;

      return courtsData.length
        ? `<p style='font-weight: normal; color: lightblue'>Add venue</p>`
        : `<button class='button is-danger'>Add venue</button>`;
    };

    const generateEmptyColumns = (num) =>
      num > 0
        ? utilities.generateRange(0, num).map((index) => ({
            headerClick: emptyColumnHeaderClick,
            title: emptyColumnHeader(index),
            headerHozAlign: CENTER,
            formatter: scheduleCell,
            headerSort: false,
            resizable: false,
            minWidth: 150
          }))
        : [];

    const columns = [controlColumn].concat(
      courtsData.map((courtInfo, index) => ({
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
      })),
      generateEmptyColumns(emptyColumnsCount)
    );

    rows.forEach((row, i) => {
      row.rowId = `rowId-${i + 1}`;
      row.rowNumber = i + 1;
    });
    return { rows, columns, matchUps, courtsCount: courtsData.length, courtsData };
  };

  const replaceTableData = ({ scheduledDate } = {}) => {
    const refresh = () => {
      const { rows, matchUps, columns, courtsData } = getTableData({ scheduledDate });
      const courtIds = courtsData?.map((court) => court.courtId);

      const equivalentCourts = utilities.intersection(existingCourtIds, courtIds).length === courtIds?.length;

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
    columns
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
