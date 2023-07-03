import { toggleOpenClose, openClose } from '../common/formatters/openClose';
import { threeDots } from '../common/formatters/threeDots';
import { headerMenu } from '../common/headerMenu';
import { setLatLong } from './setLatLong';

import { CENTER, LEFT, RIGHT } from 'constants/tmxConstants';

export function getVenuesColumns() {
  const venueActions = () => console.log('Venue actions');
  const locationFormatter = (cell) => {
    const value = cell.getValue();
    const undef = `?`;
    const def = `<i class="fa-sharp fa-solid fa-location-dot" style="color: blue"></i>`;
    return value ? def : undef;
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
      headerMenu: headerMenu({
        scheduledMatchUpsCount: 'Scheduled matches',
        availableTime: 'Time Available',
        courtsCount: 'Number of courts',
        hasLocation: 'Location'
      }),
      formatter: 'rownum',
      headerSort: false,
      hozAlign: CENTER,
      width: 55
    },
    {
      cellClick: toggleOpenClose,
      field: 'venueAbbreviation',
      title: 'Abbr',
      visible: true,
      width: 120
    },
    {
      cellClick: toggleOpenClose,
      field: 'venueName',
      title: 'Venue',
      visible: true,
      minWidth: 200,
      widthGrow: 3
    },
    {
      title: `<div class="event_icon surface_header"></div>`,
      headerTooltip: 'Number of courts',
      headerHozAlign: CENTER,
      field: 'courtsCount',
      hozAlign: CENTER,
      headerSort: true,
      visible: true,
      width: 50
    },
    {
      title: 'Scheduled',
      headerTooltip: 'Scheduled matches',
      field: 'scheduledMatchUpsCount',
      headerHozAlign: CENTER,
      headerSort: true,
      hozAlign: CENTER,
      visible: true,
      minWidth: 120
    },
    {
      title: 'Time',
      headerHozAlign: CENTER,
      field: 'availableTime',
      headerSort: true,
      hozAlign: CENTER,
      visible: true,
      minWidth: 120
    },
    {
      title: `<i class="fa-sharp fa-solid fa-location-dot"></i>`,
      formatter: locationFormatter,
      headerTooltip: 'Location',
      headerHozAlign: CENTER,
      cellClick: setLatLong,
      field: 'hasLocation',
      headerSort: false,
      hozAlign: CENTER,
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
      cellClick: venueActions,
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      width: 50
    }
  ];
}
