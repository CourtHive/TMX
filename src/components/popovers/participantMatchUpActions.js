import { eventConstants, positionActionConstants } from 'tods-competition-factory';
import { selectParticipant } from 'components/modals/selectParticipant';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tipster } from 'components/popovers/tipster';
import { isFunction } from 'functions/typeOf';

import { ASSIGN_TIE_MATCHUP_PARTICIPANT_ID } from 'constants/mutationConstants';
import { BOTTOM } from 'constants/tmxConstants';

const { ASSIGN_PARTICIPANT } = positionActionConstants;
const { TEAM } = eventConstants;

export function participantActions(e, cell, callback) {
  const tips = Array.from(document.querySelectorAll('.tippy-content'));
  if (tips.length) {
    tips.forEach((n) => n.remove());
    return;
  }
  const row = cell.getRow();
  const data = row.getData();
  const def = cell.getColumn().getDefinition();
  const participantPresent =
    (data.side1?.participantName && def.field === 'side1') || (data.side2?.participantName && def.field === 'side2');
  if (participantPresent) {
    const items = [
      {
        text: 'Assess penalty',
        onClick: () => console.log(data)
      }
    ];
    if (data.eventType === TEAM) {
      items.push({
        text: 'Assign participant',
        onClick: () => assign({ def, data, callback })
      });
    }

    tipster({ items, target: e.target, config: { placement: BOTTOM } });
  } else if (data.eventType === TEAM) {
    assign({ def, data, callback });
  }
}

function assign({ def, data, callback }) {
  const sideNumber = def.field === 'side2' ? 2 : 1;
  const participantsAvailable = data.matchUp.dualMatchUp.sides.find((side) => side.sideNumber === sideNumber)
    ?.participant?.individualParticipants;

  const onSelection = (result) => {
    if (result.participantId) {
      const participantId = participantsAvailable.find(
        (participant) => participant.participantId === result.participantId
      )?.participantId;
      const { drawId, matchUpId: tieMatchUpId } = data.matchUp;
      const methods = [
        {
          params: { participantId, sideNumber, drawId, tieMatchUpId },
          method: ASSIGN_TIE_MATCHUP_PARTICIPANT_ID
        }
      ];
      const postMutation = (result) => {
        isFunction(callback) && callback(result);
      };
      mutationRequest({ methods, callback: postMutation });
    }
  };

  const action = {
    type: ASSIGN_PARTICIPANT,
    participantsAvailable
  };

  selectParticipant({ action, onSelection });
}
