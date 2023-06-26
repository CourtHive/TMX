import { mapDrawDefinition } from 'Pages/Tournament/Tabs/eventsTab/mapDrawDefinition';
import { openClose, toggleOpenClose } from '../common/formatters/openClose';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { mapEvent } from 'Pages/Tournament/Tabs/eventsTab/mapEvent';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { controlBar } from 'components/controlBar/controlBar';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'Pages/Tournament/destroyTable';
import { tournamentEngine } from 'tods-competition-factory';
import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { addDraw } from 'components/drawers/addDraw';
import { headerMenu } from '../common/headerMenu';
import { eventActions } from '../../popovers/eventActions';

import { CENTER, LEFT, OVERLAY, NONE, RIGHT, SUB_TABLE, TOURNAMENT_EVENTS } from 'constants/tmxConstants';
import { DELETE_DRAW_DEFINITIONS } from 'constants/mutationConstants';

export function createEventsTable() {
  let table;

  const getTableData = () => {
    const events = tournamentEngine.getEvents().events;
    // TODO: optimization => pass mapEvent visible columns and only get inContext matchUps when necessary
    return events?.map(mapEvent);
  };

  const replaceTableData = () => {
    // TODO: add competitiveness column and/or highlight scores based on competitiveness
    // matchUp.competitiveness ['ROUTINE', 'DECISIVE', 'COMPETITIVE']
    table.replaceData(getTableData());
  };

  const subTableFormatter = (row) => {
    const holderEl = document.createElement('div');
    const controlEl = document.createElement('div');
    controlEl.className = 'tableControl';
    controlEl.style.marginBottom = '1em';
    const data = row.getData().drawDefs;

    holderEl.appendChild(controlEl);

    const borderStyle = '1px solid #333';
    const tableEl = document.createElement('div');
    tableEl.style.backgroundColor = 'white'; // avoid artifact in select column
    tableEl.style.border = borderStyle;
    tableEl.style.width = '99%';

    holderEl.className = SUB_TABLE;
    holderEl.style.display = NONE;
    holderEl.style.boxSizing = 'border-box';
    holderEl.style.paddingLeft = '10px';
    holderEl.style.borderTop = borderStyle;
    holderEl.style.borderBotom = borderStyle;

    holderEl.appendChild(tableEl);

    row.getElement().appendChild(holderEl);

    const drawDetail = (_, cell) => {
      const { eventId, drawId } = cell.getRow().getData();
      navigateToEvent({ eventId, drawId, renderDraw: true });
    };

    const drawActions = () => {
      console.log('drawActions');
    };

    const columns = [
      {
        cellClick: (_, cell) => cell.getRow().toggleSelect(),
        titleFormatter: 'rowSelection',
        formatter: 'rowSelection',
        headerSort: false,
        hozAlign: LEFT,
        width: 5
      },
      {
        headerSort: false,
        formatter: 'rownum',
        hozAlign: CENTER,
        headerMenu: headerMenu({ entries: 'Entries' }),
        width: 55
      },
      { title: 'Draw Name', field: 'drawName', cellClick: drawDetail },
      { title: 'Draw Type', field: 'drawType', cellClick: drawDetail },
      {
        title: '<div class="event_icon opponents_header" />',
        field: 'entries',
        width: 50
      },
      {
        cellClick: drawActions,
        formatter: threeDots,
        responsive: false,
        headerSort: false,
        hozAlign: RIGHT
      }
    ];

    const drawsTable = new Tabulator(tableEl, {
      headerSortElement: headerSortElement(['entries']),
      placeholder: 'No draws',
      layout: 'fitColumns',
      index: 'drawId',
      maxHeight: 400,
      columns,
      data
    });
    drawsTable.on('scrollVertical', destroyTipster);

    const eventId = row.getData().eventId;

    const deleteSelectedDraws = () => {
      const selectedDraws = drawsTable.getSelectedData();
      const drawIds = selectedDraws.map(({ drawId }) => drawId);
      const methods = [{ method: DELETE_DRAW_DEFINITIONS, params: { eventId, drawIds } }];
      const callback = (result) => {
        result.success && drawsTable.deleteRow(drawIds);
        const eventRow = row?.getData();
        if (eventRow) {
          const matchUps = tournamentEngine.allEventMatchUps({
            inContext: false,
            eventId
          }).matchUps;
          eventRow.matchUpsCount = matchUps?.length || 0; // table data is reactive!
          eventRow.drawsCount -= 1; // table data is reactive!
        }
      };
      mutationRequest({ methods, callback });
    };

    const drawAdded = (result) => {
      if (result.success) {
        drawsTable?.addRow(mapDrawDefinition(eventId)(result.drawDefinition));
        const eventRow = row?.getData();

        if (eventRow) {
          if (!eventRow.matchUpsCount) {
            navigateToEvent({ eventId, drawId: result.drawDefinition?.drawId, renderDraw: true });
          } else {
            const matchUps = tournamentEngine.allDrawMatchUps({
              drawId: result.drawDefinition.drawId,
              inContext: false,
              eventId
            }).matchUps;
            eventRow.matchUpsCount += matchUps?.length || 0; // table data is reactive!
            eventRow.drawsCount += 1; // table data is reactive!
          }
        }
      }
    };

    const items = [
      {
        onClick: deleteSelectedDraws,
        label: 'Delete selected',
        intent: 'is-danger',
        stateChange: true,
        location: OVERLAY
      },
      {
        onClick: () => navigateToEvent({ eventId }),
        label: 'View entries',
        intent: 'is-info',
        location: LEFT
      },
      {
        label: 'Edit event',
        location: RIGHT
      },
      {
        onClick: () => addDraw({ eventsTableRow: row, drawsTable, eventId, callback: drawAdded }),
        intent: 'is-primary',
        label: 'Add draw',
        location: RIGHT
      }
    ];
    controlBar({ table: drawsTable, target: controlEl, items });
  };

  const eventDetail = (e, cell) => {
    e.stopPropagation();
    const eventId = cell.getRow().getData().eventId;
    navigateToEvent({ eventId });
  };

  const nameClick = (e, cell) => {
    const rowData = cell.getRow().getData();
    if (rowData.drawDefs.length === 1) {
      const eventId = rowData.eventId;
      const drawId = rowData.drawDefs[0].drawId;
      navigateToEvent({ eventId, drawId, renderDraw: true });
    } else {
      toggleOpenClose(e, cell);
    }
  };

  const columns = [
    {
      cellClick: (_, cell) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      headerSort: false,
      hozAlign: LEFT,
      width: 5
    },
    {
      headerSort: false,
      formatter: 'rownum',
      hozAlign: CENTER,
      headerMenu: headerMenu({
        completedMatchUpsCount: 'Completed MatchUps',
        scheduledMatchUpsCount: 'Scheduled MatchUps',
        entriesCount: 'Accepted entries',
        matchUpsCount: 'Total matches',
        drawsCount: 'Number of draws'
      }),
      width: 55
    },
    {
      cellClick: nameClick,
      field: 'event.eventName',
      title: 'Event',
      minWidth: 200,
      visible: true,
      widthGrow: 3
    },
    {
      title: 'Type',
      field: 'event.eventType',
      visible: true
    },
    {
      title: 'Gender',
      field: 'event.gender',
      visible: true
    },
    {
      title: '<div class="event_icon drawsize_header" />',
      headerTooltip: 'Number of Draws',
      cellClick: toggleOpenClose,
      headerHozAlign: CENTER,
      field: 'drawsCount',
      hozAlign: CENTER,
      headerSort: true,
      visible: true,
      width: 45
    },
    {
      title: '<div class="event_icon opponents_header" />',
      headerTooltip: 'Accepted Entries',
      headerHozAlign: CENTER,
      field: 'entriesCount',
      cellClick: eventDetail,
      hozAlign: CENTER,
      headerSort: true,
      visible: true,
      width: 50
    },
    {
      title: '<div class="event_icon matches_header" />',
      headerTooltip: 'Total MatchUps',
      headerHozAlign: CENTER,
      field: 'matchUpsCount',
      hozAlign: CENTER,
      headerSort: true,
      visible: true,
      width: 50
    },
    {
      title: '<div class="event_icon time_header" />',
      headerTooltip: 'Scheduled MatchUps',
      field: 'scheduledMatchUpsCount',
      headerHozAlign: CENTER,
      hozAlign: CENTER,
      headerSort: true,
      visible: true,
      width: 50
    },
    {
      title: '<div class="event_icon rank_header" />',
      field: 'completedMatchUpsCount',
      headerTooltip: 'Completed MatchUps',
      headerHozAlign: CENTER,
      hozAlign: CENTER,
      headerSort: true,
      visible: true,
      width: 50
    },
    {
      cellClick: toggleOpenClose,
      formatter: openClose,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      field: 'isOpen',
      width: 20
    },
    {
      cellClick: eventActions,
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      width: 20
    }
  ];

  const render = (data) => {
    destroyTable({ anchorId: TOURNAMENT_EVENTS });
    const element = document.getElementById(TOURNAMENT_EVENTS);

    table = new Tabulator(element, {
      columnDefaults: {}, // e.g. tooltip: true, //show tool tips on cells
      headerSortElement: headerSortElement([
        'scheduledMatchUpsCount',
        'completedMatchUpsCount',
        'matchUpsCount',
        'entriesCount',
        'drawsCount'
      ]),
      responsiveLayoutCollapseStartOpen: false,
      rowFormatter: subTableFormatter,
      minHeight: window.innerHeight * 0.8,
      // height: // NOTE: setting a height causes scrolling issue
      responsiveLayout: 'collapse',
      placeholder: 'No events',
      layout: 'fitColumns',
      reactiveData: true, // updating row data will automatically update the table row!
      index: 'eventId',
      columns,
      data
    });
    table.on('scrollVertical', destroyTipster);
  };

  render(getTableData());

  return { table, replaceTableData };
}
