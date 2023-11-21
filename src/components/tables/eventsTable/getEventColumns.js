import { openClose, toggleOpenClose } from '../common/formatters/openClose';
import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { eventActions } from '../../popovers/eventActions';
import { headerMenu } from '../common/headerMenu';

import { CENTER, LEFT, RIGHT } from 'constants/tmxConstants';

export function getEventColumns() {
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

  return [
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
      field: 'event.eventType',
      title: 'Type',
      visible: true
    },
    {
      field: 'event.gender',
      title: 'Gender',
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
}
