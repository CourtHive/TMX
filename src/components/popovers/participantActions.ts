/**
 * Participant actions popover with edit and delete options.
 * Shows tipster menu with profile view, edit, and delete actions based on participant type.
 */
import { editGroupingParticipant } from 'pages/tournament/tabs/participantTab/editGroupingParticipant';
import { participantProfileModal } from 'components/modals/participantProfileModal';
import { deleteParticipants } from 'pages/tournament/tabs/participantTab/deleteParticipants';
import { editPlayer } from 'pages/tournament/tabs/participantTab/editPlayer';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'tods-competition-factory';
import { tipster } from 'components/popovers/tipster';
import { t } from 'i18n';

import { BOTTOM } from 'constants/tmxConstants';

export const participantActions = (replaceTableData: () => void) => (e: MouseEvent, cell: any): void => {
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
  const isIndividual = participantType === 'INDIVIDUAL';

  const items = [
    {
      hide: !isIndividual,
      text: "<i class='fas fa-address-card'></i> Participant profile",
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
      text: "<i class='fas fa-users'></i> Edit team",
      onClick: () => {
        const participant = tournamentEngine.getParticipants({
          participantFilters: { participantIds: [participantId] },
          inContext: false,
        }).participants?.[0];
        if (participant) {
          editGroupingParticipant({
            participant,
            refresh: replaceTableData,
            title: 'Edit team',
          });
        }
      },
    },
    {
      text: "<div style='color: var(--tmx-accent-red)'><i class='fas fa-check-square'></i> Delete participant</div>",
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
