/**
 * Participant actions popover with edit and delete options.
 * Shows tipster menu with profile view, edit, and delete actions based on participant type.
 */
import { toggleParticipantScorekeeper } from 'services/crowd/nominateScorekeeperFlow';
import { isApprovedScorekeeper } from 'services/crowd/classifyScorer';
import { editGroupingParticipant } from 'pages/tournament/tabs/participantTab/editGroupingParticipant';
import { deleteParticipants } from 'pages/tournament/tabs/participantTab/deleteParticipants';
import { participantProfileModal } from 'components/modals/participantProfileModal';
import { editPlayer } from 'pages/tournament/tabs/participantTab/editPlayer';
import { groupProfileModal } from 'components/modals/groupProfileModal';
import { teamProfileModal } from 'components/modals/teamProfileModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'services/factory/engine';
import { tipster } from 'components/popovers/tipster';
import { t } from 'i18n';

import { BOTTOM } from 'constants/tmxConstants';

export const participantActions =
  (replaceTableData: () => void) =>
  (e: MouseEvent, cell: any): void => {
    const tips = Array.from(document.querySelectorAll('.tippy-content'));
    if (tips.length) {
      tips.forEach((n) => n.remove());
      return;
    }
    const target = (e.target as HTMLElement).getElementsByClassName('fa-ellipsis-vertical')[0] as HTMLElement;
    const row = cell.getRow();
    const data = row.getData();
    const { participantId, participantType } = data;

    const isTeam = participantType === 'TEAM';
    const isGroup = participantType === 'GROUP';
    const isIndividual = participantType === 'INDIVIDUAL';

    const individualParticipant = isIndividual
      ? tournamentEngine.getParticipants({ participantFilters: { participantIds: [participantId] } }).participants?.[0]
      : undefined;
    const isScorekeeper = individualParticipant ? isApprovedScorekeeper(individualParticipant) : false;

    const items = [
      {
        hide: !isIndividual,
        text: `<i class='fas fa-address-card'></i> ${t('pages.participants.rowActions.participantProfile')}`,
        onClick: () => participantProfileModal({ participantId }),
      },
      {
        hide: !isIndividual,
        text: "<i class='fas fa-user'></i> Edit Participant",
        onClick: () => {
          editPlayer({ participantId, callback: replaceTableData });
        },
      },
      {
        hide: !isTeam,
        text: `<i class='fas fa-address-card'></i> ${t('modals.teamProfile.title')}`,
        onClick: () => teamProfileModal({ participantId }),
      },
      {
        hide: !isTeam,
        text: `<i class='fas fa-users'></i> ${t('pages.participants.rowActions.renameTeam')}`,
        onClick: () => {
          const participant = tournamentEngine.getParticipants({
            participantFilters: { participantIds: [participantId] },
          }).participants?.[0];
          if (participant) {
            editGroupingParticipant({
              participant,
              refresh: replaceTableData,
              title: 'Rename team',
            });
          }
        },
      },
      {
        // Membership was the one thing a GROUP row could not reach. Renaming and role-editing arrived
        // with the item below; adding or removing members still required discovering the unlabelled
        // chevron at the row's right edge. Same modal the name-click opens — two routes to one surface,
        // because a TD looking for "manage members" looks in the row menu.
        hide: !isGroup,
        text: `<i class='fas fa-user-plus'></i> ${t('pages.participants.rowActions.manageMembers')}`,
        onClick: () => groupProfileModal({ participantId, callback: replaceTableData }),
      },
      {
        // GROUPs had no edit affordance at all — the row's only action was Delete. That left
        // `editGroupingParticipant`'s role select reachable solely at creation time, and its
        // `updateParticipant` role branch unreachable entirely, contradicting its own premise that a
        // TD discovers a relationship at least as often after creating the group as before.
        // `participantType: GROUP` is required: it is what makes the role select render (the TEAM
        // default suppresses it, since a TEAM is pinned to COMPETITOR).
        hide: !isGroup,
        text: `<i class='fas fa-users'></i> ${t('pages.participants.rowActions.editGroup')}`,
        onClick: () => {
          const participant = tournamentEngine.getParticipants({
            participantFilters: { participantIds: [participantId] },
          }).participants?.[0];
          if (participant) {
            editGroupingParticipant({
              participantType: 'GROUP',
              refresh: replaceTableData,
              title: 'Edit group',
              participant,
            });
          }
        },
      },
      {
        hide: !isIndividual,
        text: isScorekeeper
          ? `<i class='fas fa-user-check'></i> ${t('crowd.removeScorekeeperApproval')}`
          : `<i class='fas fa-user-check'></i> ${t('crowd.approveScorekeeper')}`,
        onClick: () => {
          if (individualParticipant)
            toggleParticipantScorekeeper({ participant: individualParticipant, callback: replaceTableData });
        },
      },
      {
        text: `<div style='color: var(--tmx-accent-red)'><i class='fas fa-check-square'></i> ${t('pages.participants.rowActions.deleteParticipant')}</div>`,
        onClick: () => {
          const callback = (result: any) => {
            if (result.success) {
              row.delete();
            } else {
              tmxToast({
                message: t('toasts.cannotDeleteParticipant'),
                intent: 'is-danger',
              });
            }
          };

          deleteParticipants({ participantId, callback });
        },
      },
    ];

    tipster({ items, target: target || (e.target as HTMLElement), config: { placement: BOTTOM } });
  };
