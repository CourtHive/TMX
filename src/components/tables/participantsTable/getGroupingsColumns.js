import { toggleOpenClose, openClose } from '../common/formatters/openClose';
import { eventsFormatter } from '../common/formatters/eventsFormatter';
import { participantActions } from '../../popovers/participantActions';
import { participantConstants } from 'tods-competition-factory';
import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { headerMenu } from '../common/headerMenu';

import { CENTER, IS_OPEN, LEFT, RIGHT } from 'constants/tmxConstants';
const { GROUP } = participantConstants;

export function getGroupingsColumns({ view }) {
  const openCloseToggle = (e, cell) => {
    const result = toggleOpenClose(e, cell);
    if (result.open) {
      // TODO: display team results
    }
  };

  console.log({ view });

  return [
    {
      cellClick: (_, cell) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      responsive: false,
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
      cellClick: (e, cell) => openCloseToggle(e, cell),
      field: 'participantName',
      title: 'Name',
      minWidth: 200,
      widthGrow: 1
    },
    {
      sorter: (a, b) => a?.[0]?.eventName?.localeCompare(b?.[0]?.eventName),
      formatter: eventsFormatter(navigateToEvent),
      visible: view !== GROUP,
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
      cellClick: (e, cell) => openCloseToggle(e, cell),
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
}
