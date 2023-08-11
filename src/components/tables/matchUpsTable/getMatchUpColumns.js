import { participantMatchUpActions } from '../../popovers/participantMatchUpActions';
import { formatParticipant } from '../common/formatters/participantFormatter';
import { eventFormatter } from '../common/formatters/eventsFormatter';
import { scoreFormatter } from '../common/formatters/scoreFormatter';
import { titleFormatter } from '../common/formatters/titleFormatter';
import { matchUpActions } from 'components/popovers/matchUpActions';
import { handleScoreClick } from './handleMatchUpScoreClick';
import { tournamentEngine } from 'tods-competition-factory';
import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { headerMenu } from '../common/headerMenu';
import { context } from 'services/context';

import { CENTER, LEFT, RIGHT, SCHEDULE_TAB, TOURNAMENT } from 'constants/tmxConstants';

export function getMatchUpColumns(replaceTableData) {
  const participantSorter = (a, b) => {
    if (a.participantName && !b.participantName) return 1;
    if (b.participantName && !a.participantName) return 1;
    if (!a?.participantName && !b?.participantName) return 1;
    return a?.participantName?.localeCompare(b?.participantName);
  };

  const matchUpScheduleClick = (e, cell) => {
    const row = cell.getRow();
    const data = row.getData();
    const { courtName, scheduledDate } = data;
    if (courtName && scheduledDate) {
      const tournamentId = tournamentEngine.getState()?.tournamentRecord?.tournamentId;
      const route = `/${TOURNAMENT}/${tournamentId}/${SCHEDULE_TAB}/${scheduledDate}`;
      context.router.navigate(route);
    }
  };

  const participantChange = () => replaceTableData();

  return [
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
      width: 55
    },
    {
      formatter: eventFormatter(navigateToEvent),
      field: 'eventId',
      title: 'Event',
      visible: true,
      minWidth: 200,
      widthGrow: 1
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
      cellClick: matchUpScheduleClick,
      field: 'scheduledDate',
      title: 'Date',
      width: 110
    },
    {
      cellClick: matchUpScheduleClick,
      field: 'courtName',
      title: 'Court',
      width: 100
    },
    {
      cellClick: matchUpScheduleClick,
      field: 'scheduleTime',
      headerSort: false,
      visible: false,
      title: 'Time',
      width: 70
    },
    {
      formatter: formatParticipant(({ event, cell, ...params }) =>
        participantMatchUpActions(event, cell, participantChange, params)
      ),
      cellClick: (e, cell) => participantMatchUpActions(e, cell, participantChange),
      sorter: participantSorter,
      responsive: false,
      title: 'Side 1',
      minWidth: 180,
      field: 'side1',
      widthGrow: 1
    },
    {
      formatter: formatParticipant(({ event, cell, ...params }) =>
        participantMatchUpActions(event, cell, participantChange, params)
      ),
      cellClick: (e, cell) => participantMatchUpActions(e, cell, participantChange),
      sorter: participantSorter,
      responsive: false,
      title: 'Side 2',
      minWidth: 180,
      field: 'side2',
      widthGrow: 1
    },
    {
      cellClick: handleScoreClick(replaceTableData),
      formatter: scoreFormatter,
      responsive: false,
      title: 'Score',
      field: 'score',
      width: 140
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
      widthGrow: 0,
      width: 50
    }
  ];
}
