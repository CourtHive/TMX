import { deleteParticipants } from 'pages/tournament/tabs/participantTab/deleteParticipants';
import { editPlayer } from 'pages/tournament/tabs/participantTab/editPlayer';
import { tipster } from 'components/popovers/tipster';

import { BOTTOM } from 'constants/tmxConstants';

export const participantActions = (replaceTableData) => (e, cell) => {
  const tips = Array.from(document.querySelectorAll('.tippy-content'));
  if (tips.length) {
    tips.forEach((n) => n.remove());
    return;
  }
  const target = e.target.getElementsByClassName('fa-ellipsis-vertical')[0];
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
        editPlayer({ participantId, /*derivedEventInfo,*/ callback: replaceTableData });
      },
    },
    {
      text: "<div style='color: red'><i class='fas fa-check-square'></i> Delete participant</div>",
      onClick: () => {
        const callback = (result) => {
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

  tipster({ items, target: target || e.target, config: { placement: BOTTOM } });
};
