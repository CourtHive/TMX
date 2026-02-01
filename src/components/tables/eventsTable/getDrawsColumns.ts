/**
 * Draws table columns configuration.
 * Defines columns for draw name, type, entries, ratings, and publish/actions.
 */
import { toggleDrawPublishState } from 'services/publishing/toggleDrawPublishState';
import { visiblityFormatter } from '../common/formatters/visibility';
import { drawActions } from 'components/popovers/drawActions';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { drawEntriesClick } from './drawEntriesClick';
import { headerMenu } from '../common/headerMenu';

import { CENTER, DRAW_NAME, DRAW_TYPE, LEFT, RIGHT, UTR, WTN } from 'constants/tmxConstants';

export function getDrawsColumns(data: any[], eventRow: any): any[] {
  const flightDetail = (_: any, cell: any) => {
    const drawData = cell.getRow().getData();
    const { eventId, drawId, flightNumber } = drawData;
    const drawAdded = (result: any) => {
      if (result.success) {
        navigateToEvent({ eventId, drawId: result.drawDefinition?.drawId, renderDraw: true });
      }
    };
    // const callback = (data) => console.log('update draws table', { data }); // or go directly to draw view
    addDraw({ eventId, drawId, flightNumber, callback: drawAdded });
  };
  const drawDetail = (e: any, cell: any) => {
    e.stopPropagation();
    const drawData = cell.getRow().getData();
    const { eventId, drawId, generated } = drawData;
    if (generated) {
      navigateToEvent({ eventId, drawId, renderDraw: true });
    } else {
      flightDetail(e, cell);
    }
  };

  const utrAvg = data.find((d) => d.utrAvg);
  const wtnAvg = data.find((d) => d.wtnAvg);

  return [
    {
      cellClick: (_: any, cell: any) => cell.getRow().toggleSelect(),
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
    {
      title: '<i class="fa-solid fa-eye"></i>',
      cellClick: toggleDrawPublishState(eventRow),
      formatter: visiblityFormatter,
      headerSort: false,
      field: 'published',
      width: 55,
    },
    { title: 'Draw Name', field: DRAW_NAME, cellClick: drawDetail },
    { title: 'Draw Type', field: DRAW_TYPE, cellClick: drawDetail },
    { title: 'Flight', field: 'flightNumber', width: 70, headerSort: false, hozAlign: CENTER },
    {
      title: '<div class="event_icon opponents_header" />',
      cellClick: drawEntriesClick(eventRow),
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
      cellClick: drawActions(eventRow),
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
    },
  ];
}
