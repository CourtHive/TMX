/**
 * Participant actions popover with edit and delete options.
 * Shows tipster menu with profile view, edit, and delete actions based on participant type.
 */
import { deleteParticipants } from 'pages/tournament/tabs/participantTab/deleteParticipants';
import { editPlayer } from 'pages/tournament/tabs/participantTab/editPlayer';
import { tipster } from 'components/popovers/tipster';

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

  const items = [
    {
      hide: participantType !== 'INDIVIDUAL',
      text: "<i class='fas fa-address-card'></i> Participant profile",
      onClick: () => console.log('Participant profile', cell.getData()?.participant),
    },
    {
      hide: participantType !== 'INDIVIDUAL',
      text: "<i class='fas fa-user'></i> Edit Participant",
      onClick: () => {
        editPlayer({ participantId, callback: replaceTableData });
      },
    },
    {
      text: "<div style='color: var(--tmx-accent-red)'><i class='fas fa-check-square'></i> Delete participant</div>",
      onClick: () => {
        const callback = (result: any) => {
          if (result.success) {
            row.delete();
          } else {
            const thisTable = cell.getTable();
            thisTable.alert(result.error.message || 'Cannot Remove Participant');
            setTimeout(() => thisTable.clearAlert(), 2500);
          }
        };

        deleteParticipants({ participantId, callback });
      },
    },
  ];

  tipster({ items, target: target || (e.target as HTMLElement), config: { placement: BOTTOM } });
};
