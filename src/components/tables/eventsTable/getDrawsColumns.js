import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { headerMenu } from '../common/headerMenu';

import { CENTER, LEFT, RIGHT } from 'constants/tmxConstants';

export function getDrawsColumns() {
  const drawActions = () => {
    console.log('drawActions');
  };
  const drawDetail = (_, cell) => {
    const { eventId, drawId } = cell.getRow().getData();
    navigateToEvent({ eventId, drawId, renderDraw: true });
  };

  return [
    {
      cellClick: (_, cell) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      headerSort: false,
      responsive: false,
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
}
