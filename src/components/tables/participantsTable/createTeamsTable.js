import { participantResponsiveLayourFormatter } from './participantResponsiveLayoutFormatter';
import { mapTeamParticipant } from 'Pages/Tournament/Tabs/participantTab/mapTeamParticipant';
import { tournamentEngine, participantConstants } from 'tods-competition-factory';
import { toggleOpenClose, openClose } from '../common/formatters/openClose';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { eventsFormatter } from '../common/formatters/eventsFormatter';
import { controlBar } from 'components/controlBar/controlBar';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'Pages/Tournament/destroyTable';
import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { participantActions } from './participantActions';
import { headerMenu } from '../common/headerMenu';

import { CENTER, IS_OPEN, LEFT, NONE, OVERLAY, RIGHT, SUB_TABLE, TOURNAMENT_TEAMS } from 'constants/tmxConstants';

const { TEAM } = participantConstants;

export function createTeamsTable({ view } = {}) {
  let table, participants, derivedEventInfo, ready;

  const getTableData = () => {
    const result = tournamentEngine.getParticipants({
      participantFilters: { participantTypes: [view || TEAM] },
      withIndividualParticipants: true,
      withEvents: true
    });
    ({ participants, derivedEventInfo } = result);

    return participants.map((p) => mapTeamParticipant(p, derivedEventInfo));
  };

  const replaceTableData = () => {
    const refresh = () => table.replaceData(getTableData());
    setTimeout(refresh, ready ? 0 : 1000);
  };

  const subTableFormatter = (row) => {
    const holderEl = document.createElement('div');

    const controlEl = document.createElement('div');
    controlEl.className = 'tableControl';
    controlEl.style.marginBottom = '1em';

    const items = [
      {
        label: 'Delete selected',
        intent: 'is-danger',
        stateChange: true,
        location: OVERLAY
      },
      {
        label: 'Add players',
        intent: 'is-primary',
        location: RIGHT
      }
    ];

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

    const ipTable = new Tabulator(tableEl, {
      data: row.getData().individualParticipants,
      placeholder: 'No individual participants',
      index: 'participantId',
      layout: 'fitColumns',
      maxHeight: 400,
      columns: [
        {
          cellClick: (_, cell) => cell.getRow().toggleSelect(),
          titleFormatter: 'rowSelection',
          formatter: 'rowSelection',
          headerSort: false,
          hozAlign: LEFT,
          width: 5
        },
        { title: 'Name', field: 'participantName' },
        { title: 'Gender', field: 'person.sex', width: 100 }
      ]
    });
    ipTable.on('scrollVertical', destroyTipster);

    controlBar({ table: ipTable, target: controlEl, items });
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
      formatter: 'responsiveCollapse',
      width: 50,
      minWidth: 50,
      hozAlign: CENTER,
      resizable: false,
      headerSort: false
    },
    {
      headerMenu: headerMenu({
        matchUpsCount: 'Total MatchUps',
        membersCount: 'Individuals',
        winLoss: 'Win/Loss'
      }),
      formatter: 'rownum',
      headerSort: false,
      hozAlign: LEFT,
      width: 55
    },
    {
      cellClick: toggleOpenClose,
      field: 'participantName',
      title: 'Name',
      minWidth: 200,
      widthGrow: 1
    },
    {
      sorter: (a, b) => a?.[0]?.eventName?.localeCompare(b?.[0]?.eventName),
      formatter: eventsFormatter(navigateToEvent),
      hozAlign: LEFT,
      field: 'events',
      title: 'Events',
      minWidth: 300,
      editor: false,
      widthGrow: 2
    },
    {
      title: '<div class="event_icon opponents_header" />',
      headerTooltip: 'Individuals',
      headerHozAlign: CENTER,
      field: 'membersCount',
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
      title: '<div class="event_icon winloss_header" />',
      headerTooltip: 'Win/Loss',
      headerHozAlign: CENTER,
      field: 'winLoss',
      hozAlign: CENTER,
      headerSort: true,
      visible: true,
      width: 50
    },
    {
      field: 'representing',
      title: 'Representing',
      visible: false,
      minWidth: 200
    },
    {
      cellClick: toggleOpenClose,
      formatter: openClose,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      field: IS_OPEN,
      width: 20
    },
    {
      cellClick: participantActions,
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      width: 20
    }
  ];

  const render = (data) => {
    destroyTable({ anchorId: TOURNAMENT_TEAMS });
    const element = document.getElementById(TOURNAMENT_TEAMS);

    table = new Tabulator(element, {
      headerSortElement: headerSortElement(['events', 'membersCount', 'matchUpsCount', 'winLoss']),
      responsiveLayoutCollapseFormatter: participantResponsiveLayourFormatter,
      responsiveLayoutCollapseStartOpen: false,
      minHeight: window.innerHeight * 0.81,
      height: window.innerHeight * 0.86,
      placeholder: 'No team participants',
      rowFormatter: subTableFormatter,
      responsiveLayout: 'collapse',
      index: 'participantId',
      layout: 'fitColumns',
      reactiveData: true,
      data,
      /*
      // NOTE: persistence causes filter cleanup warnings in console
      persistence: { filter: true, sort: true },
      persistenceID: 'trnyPtcpt',
      */
      columns
    });

    table.on('scrollVertical', destroyTipster);
    table.on('tableBuilt', () => (ready = true));
  };

  render(getTableData());

  return { table, replaceTableData };
}
