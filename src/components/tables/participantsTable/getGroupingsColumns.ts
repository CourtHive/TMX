/**
 * Column definitions for groupings/teams table.
 * Displays team names, events, member counts, match statistics, and actions.
 */
import { toggleOpenClose, openClose } from '../common/formatters/openClose';
import { eventsFormatter } from '../common/formatters/eventsFormatter';
import { participantActions } from '../../popovers/participantActions';
import { groupProfileModal } from '../../modals/groupProfileModal';
import { teamProfileModal } from '../../modals/teamProfileModal';
import { participantConstants, participantRoles } from 'tods-competition-factory';
import { navigateToEvent } from '../common/navigateToEvent';
import { roleBadge } from '../common/formatters/roleBadge';
import { threeDots } from '../common/formatters/threeDots';
import { headerMenu } from '../common/headerMenu';

import { CENTER, IS_OPEN, LEFT, RIGHT } from 'constants/tmxConstants';
import { t } from 'i18n';

const { GROUP, TEAM } = participantConstants;
const { OTHER } = participantRoles;

export function getGroupingsColumns({
  view,
  replaceTableData,
}: {
  view?: string;
  replaceTableData: () => void;
}): any[] {
  const openCloseToggle = (e: Event, cell: any) => {
    const result = toggleOpenClose(e, cell);
    if (result?.open) {
      // TODO: display team results
    }
  };

  return [
    {
      cellClick: (_: Event, cell: any) => cell.getRow().toggleSelect(),
      titleFormatter: 'rowSelection',
      formatter: 'rowSelection',
      responsive: false,
      headerSort: false,
      hozAlign: LEFT,
      width: 5,
    },
    {
      formatter: 'responsiveCollapse',
      width: 50,
      minWidth: 50,
      hozAlign: CENTER,
      resizable: false,
      headerSort: false,
    },
    {
      headerMenu: headerMenu({
        matchUpsCount: 'Total MatchUps',
        membersCount: 'Individuals',
        winLoss: 'Win/Loss',
      }),
      formatter: 'rownum',
      headerSort: false,
      headerHozAlign: CENTER,
      hozAlign: CENTER,
      width: 65,
    },
    {
      cellClick: (e: Event, cell: any) => {
        // Both grouping types now open a profile on name-click. A TEAM gets the read-only roster /
        // coaches / staff split; a GROUP gets its membership plus the relationship role and what that
        // role does. Previously only TEAM had a profile and a GROUP name-click toggled the collapse,
        // which left membership reachable only through the unlabelled chevron at the row's right edge.
        const { participantId } = cell.getRow().getData();
        if (participantId) {
          if (view === TEAM) {
            teamProfileModal({ participantId });
            return;
          }
          if (view === GROUP) {
            groupProfileModal({ participantId, callback: replaceTableData });
            return;
          }
        }
        openCloseToggle(e, cell);
      },
      field: 'participantName',
      title: t('tables.groupings.name'),
      minWidth: 200,
      widthGrow: 1,
    },
    {
      // GROUP only. A group's role is what escalates a SHARED_GROUPING conflict from WARN to BLOCK, so a
      // TD needs to see at a glance which groups carry a blocking relationship. OTHER is the neutral
      // default and is left blank rather than rendered as a badge, so only meaningful roles draw the eye.
      formatter: (cell: any) => {
        const role = cell.getValue();
        return role === OTHER ? '' : roleBadge(role);
      },
      title: t('pages.participants.groupRole'),
      visible: view === GROUP,
      field: 'participantRole',
      headerHozAlign: CENTER,
      hozAlign: CENTER,
      headerSort: true,
      minWidth: 110,
      editor: false,
    },
    {
      sorter: (a: any, b: any) => a?.[0]?.eventName?.localeCompare(b?.[0]?.eventName, undefined, { numeric: true }),
      formatter: eventsFormatter(navigateToEvent),
      visible: view !== GROUP,
      hozAlign: LEFT,
      field: 'events',
      title: t('tables.groupings.events'),
      minWidth: 300,
      editor: false,
      widthGrow: 2,
    },
    {
      title: '<i class="fa-solid fa-user-group" />',
      headerTooltip: 'Individuals',
      headerHozAlign: CENTER,
      field: 'membersCount',
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
      visible: true,
      width: 50,
    },
    {
      title: '<i class="fa-solid fa-trophy" />',
      headerTooltip: 'Win/Loss',
      headerHozAlign: CENTER,
      field: 'winLoss',
      hozAlign: CENTER,
      headerSort: true,
      visible: true,
      width: 50,
    },
    {
      field: 'representing',
      title: t('tables.groupings.representing'),
      visible: false,
      minWidth: 200,
    },
    {
      cellClick: openCloseToggle,
      formatter: openClose,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      field: IS_OPEN,
      width: 20,
    },
    {
      cellClick: participantActions(replaceTableData),
      formatter: threeDots,
      responsive: false,
      headerSort: false,
      hozAlign: RIGHT,
      width: 20,
    },
  ];
}
