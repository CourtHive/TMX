import { eventConstants, positionActionConstants, utilities } from 'tods-competition-factory';
import { selectParticipant } from 'components/modals/selectParticipant';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tipster } from 'components/popovers/tipster';
import { isFunction } from 'functions/typeOf';

import { ASSIGN_TIE_MATCHUP_PARTICIPANT_ID } from 'constants/mutationConstants';
import { BOTTOM } from 'constants/tmxConstants';

const { ASSIGN_PARTICIPANT } = positionActionConstants;
const { TEAM, DOUBLES } = eventConstants;

const xa = utilities.extractAttributes;

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
  const participantsAvailable = data.matchUp.dualMatchUp.sides
    .find((side) => side.sideNumber === sideNumber)
    ?.participant?.individualParticipants?.map((p) => ({
      participantName: p.participantName,
      participantId: p.participantId
    }));
  const matchUpType = data.matchUp.matchUpType;

  const side = data.matchUp.sides.find((side) => sideNumber === side.sideNumber);
  const existingParticipantIds = side?.participant?.individualParticipantIds;

  const selectionLimit = matchUpType === DOUBLES ? 2 : 1;
  const onSelection = (result) => {
    if (result.participantId) {
      const methods = [];
      const participantIds = (
        result.selected ? result.selected.map(xa('participantId')) : [result.participantId]
      ).filter(Boolean);

      participantIds.forEach((participantId) => {
        const { drawId, matchUpId: tieMatchUpId } = data.matchUp;
        methods.push({
          params: { participantId, sideNumber, drawId, tieMatchUpId },
          method: ASSIGN_TIE_MATCHUP_PARTICIPANT_ID
        });
      });

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

  selectParticipant({ action, selectionLimit, onSelection, selectedParticipantIds: existingParticipantIds });
}
