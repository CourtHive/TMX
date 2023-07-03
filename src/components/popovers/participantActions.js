import { editPlayer } from 'Pages/Tournament/Tabs/participantTab/editPlayer';
import { deleteParticipants } from 'Pages/Tournament/Tabs/participantTab/deleteParticipants';
import { tipster } from 'components/popovers/tipster';

import { BOTTOM } from 'constants/tmxConstants';

export function participantActions(e, cell) {
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
      onClick: () => console.log('Participant profile')
    },
    {
      hide: participantType !== 'INDIVIDUAL',
      text: "<i class='fas fa-user'></i> Edit Participant",
      onClick: () => {
        const callback = (data) => data.participantId && row.update(data);
        editPlayer({ participantId, /*derivedEventInfo,*/ callback });
      }
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
      }
    }
  ];

  tipster({ items, target: target || e.target, config: { placement: BOTTOM } });
}
