import { participantActions } from '../../popovers/participantMatchUpActions';
import { formatParticipant } from '../common/formatters/participantFormatter';
import { eventFormatter } from '../common/formatters/eventsFormatter';
import { scoreFormatter } from '../common/formatters/scoreFormatter';
import { titleFormatter } from '../common/formatters/titleFormatter';
import { matchUpActions } from 'components/popovers/matchUpActions';
import { handleScoreClick } from './handleMatchUpScoreClick';
import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { headerMenu } from '../common/headerMenu';

import { CENTER, LEFT, RIGHT } from 'constants/tmxConstants';

export function getMatchUpColumns(replaceTableData) {
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
      formatter: formatParticipant,
      cellClick: participantActions,
      responsive: false,
      title: 'Side 1',
      minWidth: 100,
      field: 'side1'
    },
    {
      formatter: formatParticipant,
      cellClick: participantActions,
      responsive: false,
      title: 'Side 2',
      minWidth: 100,
      field: 'side2'
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
}
