/**
 * Column definitions for events table.
 * Defines columns for event display including name, type, counts, and actions.
 */
import { navigateToEvent } from '../common/navigateToEvent';
import { headerMenu } from '../common/headerMenu';

import { CENTER, LEFT } from 'constants/tmxConstants';
import { t } from 'i18n';

export function getEventColumns(getLightMode?: () => boolean): any[] {
  const isLightMode = typeof getLightMode === 'function' ? getLightMode() : false;

  const eventDetail = (e: any, cell: any) => {
    e.stopPropagation();
    const eventId = cell.getRow().getData().eventId;
    navigateToEvent({ eventId });
  };

  return [
    {
      cellClick: (_: any, cell: any) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      headerSort: false,
      hozAlign: LEFT,
      width: 5,
    },
    {
      headerMenu: headerMenu({
        completedMatchUpsCount: 'Completed MatchUps',
        scheduledMatchUpsCount: 'Scheduled MatchUps',
        entriesCount: 'Accepted entries',
        matchUpsCount: 'Total matches',
        drawsCount: 'Number of draws',
      }),
      formatter: 'rownum',
      headerSort: false,
      headerHozAlign: CENTER,
      hozAlign: CENTER,
      width: 65,
    },
    {
      field: 'event.eventName',
      cellClick: eventDetail,
      title: t('tables.events.event'),
      minWidth: 200,
      visible: true,
      widthGrow: 3,
    },
    {
      field: 'event.eventType',
      title: t('tables.events.type'),
      visible: true,
    },
    {
      field: 'event.gender',
      title: t('tables.events.gender'),
      visible: true,
    },
    {
      title: '<i class="fa-solid fa-sitemap" />',
      headerTooltip: 'Number of Draws',
      cellClick: (_: any, cell: any) => {
        const eventId = cell.getRow().getData().eventId;
        navigateToEvent({ eventId, renderDraw: true });
      },
      headerHozAlign: CENTER,
      field: 'drawsCount',
      hozAlign: CENTER,
      headerSort: true,
      visible: true,
      width: 45,
    },
    {
      title: '<i class="fa-solid fa-user-group" />',
      headerTooltip: 'Accepted Entries',
      headerHozAlign: CENTER,
      field: 'entriesCount',
      cellClick: eventDetail,
      hozAlign: CENTER,
      headerSort: true,
      visible: true,
      width: 50,
    },
    {
      title: '<i class="fa-solid fa-table-tennis-paddle-ball" />',
      headerTooltip: 'Total MatchUps',
      headerHozAlign: CENTER,
      field: 'matchUpsCount',
      hozAlign: CENTER,
      headerSort: true,
      visible: !isLightMode,
      width: 50,
    },
    {
      title: '<i class="fa-solid fa-clock" />',
      headerTooltip: 'Scheduled MatchUps',
      field: 'scheduledMatchUpsCount',
      headerHozAlign: CENTER,
      hozAlign: CENTER,
      headerSort: true,
      visible: !isLightMode,
      width: 50,
    },
    {
      title: '<i class="fa-solid fa-flag-checkered" />',
      headerTooltip: 'Completed MatchUps',
      field: 'completedMatchUpsCount',
      headerHozAlign: CENTER,
      hozAlign: CENTER,
      headerSort: true,
      visible: !isLightMode,
      width: 50,
    },
  ];
}
