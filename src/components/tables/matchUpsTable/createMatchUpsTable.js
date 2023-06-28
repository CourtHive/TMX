import { participantActions } from '../../popovers/participantMatchUpActions';
import { mapMatchUp } from 'Pages/Tournament/Tabs/matchUpsTab/mapMatchUp';
import { headerSortElement } from '../common/sorters/headerSortElement';
import { eventFormatter } from '../common/formatters/eventsFormatter';
import { scoreFormatter } from '../common/formatters/scoreFormatter';
import { matchUpActions } from 'components/popovers/matchUpActions';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { highlightWinningSide } from './highlightWinningSide';
import { destroyTable } from 'Pages/Tournament/destroyTable';
import { tournamentEngine } from 'tods-competition-factory';
import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { headerMenu } from '../common/headerMenu';
import { scoreMatchUp } from './scoreMatchUp';

import { CENTER, LEFT, RIGHT, TOURNAMENT_MATCHUPS } from 'constants/tmxConstants';

export function createMatchUpsTable() {
  let table;

  // EXAMPLE: renders same as default
  function titleFormatter(cell) {
    const elem = document.createElement('div');
    elem.style = 'font-weight: bold';
    elem.innerHTML = cell.getValue();
    return elem;
  }

  const getTableData = () => {
    const matchUps = (
      tournamentEngine.allTournamentMatchUps({ contextProfile: { withCompetitiveness: true } }).matchUps || []
    ).filter(({ matchUpStatus }) => matchUpStatus !== 'BYE');
    return matchUps.map(mapMatchUp);
  };

  const replaceTableData = () => {
    // TODO: add competitiveness column and/or highlight scores based on competitiveness
    // matchUp.competitiveness ['ROUTINE', 'DECISIVE', 'COMPETITIVE']
    table.replaceData(getTableData());
  };

  const columns = [
    {
      cellClick: (e, cell) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      headerSort: false,
      responsive: false,
      hozAlign: LEFT,
      width: 5
    },
    {
      formatter: 'responsiveCollapse',
      headerSort: false,
      resizable: false,
      hozAlign: CENTER,
      minWidth: 50,
      width: 50
    },
    {
      headerMenu: headerMenu({
        duration: 'Duration',
        complete: 'Complete'
      }),
      formatter: 'rownum',
      headerSort: false,
      hozAlign: LEFT,
      minWidth: 55
    },
    {
      title: `<div class='fa-solid fa-check' style='color: green' />`,
      formatter: 'tickCross',
      field: 'complete',
      hozAlign: LEFT,
      tooltip: false,
      width: 40
    },
    {
      formatter: eventFormatter(navigateToEvent),
      field: 'eventId',
      title: 'Event',
      visible: true,
      minWidth: 100
    },
    {
      field: 'matchUpType',
      titleFormatter,
      title: 'Type',
      minWidth: 90
    },
    {
      field: 'roundName',
      title: 'Round',
      titleFormatter,
      minWidth: 90
    },
    {
      field: 'scheduledDate',
      title: 'Date',
      width: 110
    },
    {
      field: 'courtName',
      title: 'Court',
      width: 100
    },
    {
      field: 'scheduleTime',
      headerSort: false,
      visible: false,
      title: 'Time',
      width: 70
    },
    {
      formatter: highlightWinningSide,
      cellClick: participantActions,
      responsive: false,
      title: 'Side 1',
      minWidth: 100,
      field: 'side1'
    },
    {
      formatter: highlightWinningSide,
      cellClick: participantActions,
      responsive: false,
      title: 'Side 2',
      minWidth: 100,
      field: 'side2'
    },
    {
      cellClick: scoreMatchUp(replaceTableData),
      formatter: scoreFormatter,
      responsive: false,
      title: 'Score',
      field: 'score',
      width: 140
    },
    {
      field: 'matchUp.matchUpStatus',
      title: 'Status',
      width: 150
    },
    {
      title: `<div class='fa-solid fa-clock' style='color: blue' />`,
      headerSort: false,
      field: 'duration',
      visible: false,
      width: 70
    },
    {
      cellClick: matchUpActions,
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      width: 50
    }
  ];

  const render = (data) => {
    destroyTable({ anchorId: TOURNAMENT_MATCHUPS });
    const element = document.getElementById(TOURNAMENT_MATCHUPS);

    table = new Tabulator(element, {
      headerSortElement: headerSortElement(['complete', 'duration', 'score']),
      responsiveLayoutCollapseStartOpen: false,
      height: window.innerHeight * 0.85,
      responsiveLayout: 'collapse',
      placeholder: 'No matches',
      layout: 'fitDataStretch',
      reactiveData: true,
      index: 'matchUpId',
      columns,
      data
    });
  };

  render(getTableData());

  return { table, replaceTableData };
}
