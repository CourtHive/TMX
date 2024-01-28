import { formatParticipant } from '../common/formatters/participantFormatter';
import { participantSorter } from '../common/sorters/participantSorter';
import { headerMenu } from '../common/headerMenu';

import { CENTER, LEFT } from 'constants/tmxConstants';

export function getStatsColumns() {
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
      headerMenu: headerMenu({
        // sex: 'Gender', // provide mapping of icon column headers to field names
      }),
      formatter: 'rownum',
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
      // cellClick: participantActions,
      sorter: participantSorter,
      field: 'participantName',
      responsive: false,
      resizable: false,
      minWidth: 200,
      widthGrow: 2,
      title: 'Name',
    },
    {
      field: 'participantId',
      title: 'Id',
    },
  ];
}
