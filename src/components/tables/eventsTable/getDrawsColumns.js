import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { headerMenu } from '../common/headerMenu';

import { CENTER, DRAW_NAME, DRAW_TYPE, LEFT, RIGHT, UTR, WTN } from 'constants/tmxConstants';

export function getDrawsColumns(data) {
  const drawActions = () => {
    console.log('drawActions');
  };
  const drawDetail = (_, cell) => {
    const { eventId, drawId } = cell.getRow().getData();
    navigateToEvent({ eventId, drawId, renderDraw: true });
  };

  const utrAvg = data.find((d) => d.utrAvg);
  const wtnAvg = data.find((d) => d.wtnAvg);

  return [
    {
      cellClick: (_, cell) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      headerSort: false,
      responsive: false,
      hozAlign: LEFT,
      width: 5,
    },
    {
      headerMenu: headerMenu({ entries: 'Entries', wtnAvg: 'WTN avg', utrAvg: 'UTR avg' }),
      headerSort: false,
      formatter: 'rownum',
      hozAlign: CENTER,
      width: 55,
    },
    { title: 'Draw Name', field: DRAW_NAME, cellClick: drawDetail },
    { title: 'Draw Type', field: DRAW_TYPE, cellClick: drawDetail },
    {
      title: '<div class="event_icon opponents_header" />',
      field: 'entries',
      width: 50,
    },
    {
      visible: !!wtnAvg,
      field: 'wtnAvg',
      title: WTN,
      width: 80,
    },
    {
      visible: !!utrAvg,
      field: 'utrAvg',
      title: UTR,
      width: 80,
    },
    {
      cellClick: drawActions,
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
    },
  ];
}
