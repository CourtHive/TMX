import { formatParticipant } from '../common/formatters/participantFormatter';
import { percentFormatter } from '../common/formatters/percentFormatter';
import { participantSorter } from '../common/sorters/participantSorter';
import { percentSorter } from '../common/sorters/percentSorter';
import { orderSorter } from '../common/sorters/orderSorter';
import { headerMenu } from '../common/headerMenu';

import { CENTER, LEFT } from 'constants/tmxConstants';

export function getStatsColumns() {
  return [
    {
      headerMenu: headerMenu({
        // sex: 'Gender', // provide mapping of icon column headers to field names
      }),
      // formatter: 'rownum',
      field: 'drawPosition',
      headerSort: false,
      hozAlign: LEFT,
      width: 55,
    },
    {
      formatter: 'responsiveCollapse',
      hozAlign: CENTER,
      responsive: false,
      headerSort: false,
      resizable: false,
      width: 50,
    },
    {
      formatter: formatParticipant(({ event, cell, ...params }) =>
        console.log('cell clicked', { event, cell, undefined, params }),
      ),
      sorter: participantSorter,
      field: 'participantName',
      responsive: false,
      resizable: false,
      maxWidth: 400,
      minWidth: 200,
      widthGrow: 2,
      title: 'Name',
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: 'Match W/L',
      hozAlign: CENTER,
      maxWidth: 80,
      field: 'result',
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'matchUpsPct',
      title: 'Match Win%',
      hozAlign: CENTER,
      maxWidth: 80,
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'setsResult',
      title: 'Sets W/L',
      hozAlign: CENTER,
      maxWidth: 80,
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: 'Set Win%',
      hozAlign: CENTER,
      field: 'setsPct',
      maxWidth: 80,
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'gamesResult',
      title: 'Games W/L',
      hozAlign: CENTER,
      maxWidth: 80,
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: 'Game Win%',
      hozAlign: CENTER,
      field: 'gamesPct',
      maxWidth: 80,
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'pointsResult',
      title: 'Points W/L',
      hozAlign: CENTER,
      maxWidth: 80,
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: 'Points Win%',
      field: 'pointsPct',
      hozAlign: CENTER,
      maxWidth: 80,
    },
    {
      formatter: percentFormatter,
      field: 'averageVariation',
      headerHozAlign: CENTER,
      sorter: percentSorter,
      hozAlign: CENTER,
      maxWidth: 70,
      title: 'RV',
    },
    {
      formatter: percentFormatter,
      field: 'averagePressure',
      headerHozAlign: CENTER,
      sorter: percentSorter,
      hozAlign: CENTER,
      maxWidth: 70,
      title: 'PS',
    },
    {
      headerHozAlign: CENTER,
      field: 'pressureOrder',
      sorter: orderSorter,
      title: 'PS#',
      hozAlign: CENTER,
      maxWidth: 80,
    },
    {
      headerHozAlign: CENTER,
      sorter: orderSorter,
      hozAlign: CENTER,
      title: 'Order',
      field: 'order',
      maxWidth: 80,
    },
    {
      field: 'groupName',
      visible: false,
      title: 'Group',
    },
  ];
}
