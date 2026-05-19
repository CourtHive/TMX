import { toggleOpenClose, openClose } from '../common/formatters/openClose';
import { venueActions } from '../../popovers/venueActions';
import { threeDots } from '../common/formatters/threeDots';
import { headerMenu } from '../common/headerMenu';
import { setLatLong } from './setLatLong';

import { CENTER, LEFT, RIGHT } from 'constants/tmxConstants';
import { t } from 'i18n';

export function getVenuesColumns(nestedTables: any): any[] {
  const locationFormatter = (cell: any): string => {
    const value = cell.getValue();
    const undef = `?`;
    const def = `<i class="fa-sharp fa-solid fa-location-dot" style="color: var(--tmx-accent-blue)"></i>`;
    return value ? def : undef;
  };

  const websiteFormatter = (cell: any): string => {
    const url = cell.getValue();
    if (!url) return '';
    return `<i class="fa-solid fa-globe" style="color: var(--tmx-accent-blue)"></i>`;
  };

  const openWebsite = (e: any, cell: any): void => {
    const url = cell.getValue();
    if (!url) return;
    e?.stopPropagation?.();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return [
    {
      cellClick: (_: any, cell: any) => cell.getRow().toggleSelect(),
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
      headerHozAlign: CENTER,
      hozAlign: CENTER,
      width: 65
    },
    {
      cellClick: toggleOpenClose,
      field: 'venueAbbreviation',
      title: t('tables.venues.abbr'),
      visible: true,
      width: 120
    },
    {
      cellClick: toggleOpenClose,
      field: 'venueName',
      title: t('tables.venues.venue'),
      visible: true,
      minWidth: 200,
      widthGrow: 3
    },
    {
      title: '<i class="fa-solid fa-table-columns" />',
      headerTooltip: 'Number of courts',
      headerHozAlign: CENTER,
      field: 'courtsCount',
      hozAlign: CENTER,
      headerSort: true,
      visible: true,
      width: 50
    },
    {
      title: t('tables.venues.scheduled'),
      headerTooltip: 'Scheduled matches',
      field: 'scheduledMatchUpsCount',
      headerHozAlign: CENTER,
      headerSort: true,
      hozAlign: CENTER,
      visible: true,
      minWidth: 120
    },
    {
      title: t('tables.venues.time'),
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
      title: `<i class="fa-solid fa-globe"></i>`,
      formatter: websiteFormatter,
      headerTooltip: 'Website',
      headerHozAlign: CENTER,
      cellClick: openWebsite,
      field: 'venueWebsiteURL',
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
      cellClick: venueActions(nestedTables),
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      width: 50
    }
  ];
}
