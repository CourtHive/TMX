/**
 * Column definitions for events table.
 * Defines columns for event display including name, type, counts, and actions.
 */
import { toggleEventPublishState } from 'services/publishing/toggleEventPublishState';
import { openClose, toggleOpenClose } from '../common/formatters/openClose';
import { visiblityFormatter } from '../common/formatters/visibility';
import { navigateToEvent } from '../common/navigateToEvent';
import { threeDots } from '../common/formatters/threeDots';
import { eventActions } from '../../popovers/eventActions';
import { headerMenu } from '../common/headerMenu';

import { CENTER, LEFT, RIGHT } from 'constants/tmxConstants';
import { t } from 'i18n';

export function getEventColumns(nestedTables: any, getLightMode?: () => boolean): any[] {
  const isLightMode = typeof getLightMode === 'function' ? getLightMode() : false;

  const eventDetail = (e: any, cell: any) => {
    e.stopPropagation();
    const eventId = cell.getRow().getData().eventId;
    navigateToEvent({ eventId });
  };

  const nameClick = (e: any, cell: any) => {
    toggleOpenClose(e, cell);
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
        published: 'Published',
      }),
      formatter: 'rownum',
      headerSort: false,
      hozAlign: CENTER,
      width: 55,
    },
    {
      title: '<i class="fa-solid fa-eye"></i>',
      cellClick: toggleEventPublishState(nestedTables),
      formatter: visiblityFormatter,
      headerSort: false,
      field: 'published',
      width: 55,
    },
    {
      field: 'event.eventName',
      cellClick: nameClick,
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
      title: '<div class="event_icon drawsize_header" />',
      headerTooltip: 'Number of Draws',
      cellClick: toggleOpenClose,
      headerHozAlign: CENTER,
      field: 'drawsCount',
      hozAlign: CENTER,
      headerSort: true,
      visible: true,
      width: 45,
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
      width: 50,
    },
    {
      title: '<div class="event_icon matches_header" />',
      headerTooltip: 'Total MatchUps',
      headerHozAlign: CENTER,
      field: 'matchUpsCount',
      hozAlign: CENTER,
      headerSort: true,
      visible: !isLightMode,
      width: 50,
    },
    {
      title: '<div class="event_icon time_header" />',
      headerTooltip: 'Scheduled MatchUps',
      field: 'scheduledMatchUpsCount',
      headerHozAlign: CENTER,
      hozAlign: CENTER,
      headerSort: true,
      visible: !isLightMode,
      width: 50,
    },
    {
      title: '<div class="event_icon rank_header" />',
      headerTooltip: 'Completed MatchUps',
      field: 'completedMatchUpsCount',
      headerHozAlign: CENTER,
      hozAlign: CENTER,
      headerSort: true,
      visible: !isLightMode,
      width: 50,
    },
    {
      cellClick: toggleOpenClose,
      formatter: openClose,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      field: 'isOpen',
      width: 20,
    },
    {
      cellClick: eventActions(nestedTables),
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      width: 20,
    },
  ];
}
