import { mutationRequest } from 'services/mutation/mutationRequest';
import { tipster } from 'components/popovers/tipster';

const actionLabels = {
  ALTERNATE: 'Assign alternate',
  ASSIGN: 'Assign participant',
  BYE: 'Assign BYE',
  REMOVE: 'Remove assignment',
  SWAP: 'Swap draw positions',
  WITHDRAW: 'Withdraw participant'
};

export function selectPositionAction({ event, actions, callback }) {
  const handleClick = (action) => {
    ['WITHDRAW', 'BYE', 'REMOVE'].includes(action.type) && noChoiceAction({ action, callback });
    action.type === 'ASSIGN' && assignParticipant({ action, callback });
    action.type === 'ALTERNATE' && assignAlternate({ action, callback });
    action.type === 'SWAP' && swapPositions({ action, callback });
  };
  const options = actions
    ?.filter(({ type }) => actionLabels[type])
    .map((action) => ({
      option: actionLabels[action.type] || action.type,
      onClick: () => handleClick(action)
    }));

  const target = event.target;
  tipster({ options, target, config: { arrow: false, offset: [0, 0] } });
}

function noChoiceAction({ action, callback }) {
  const postMutation = (result) => (result.success ? callback() : console.log({ result }));
  const methods = [{ method: action.method, params: action.payload }];
  mutationRequest({ methods, callback: postMutation });
}

function assignParticipant({ action, callback }) {
  const postMutation = (result) => (result.success ? callback() : console.log({ result }));
  const participantId = action.participantsAvailable[0].participantId;
  const methods = [
    {
      params: { ...action.payload, participantId },
      method: action.method
    }
  ];
  mutationRequest({ methods, callback: postMutation });
}

function assignAlternate({ action, callback }) {
  const postMutation = (result) => (result.success ? callback() : console.log({ result }));
  const alternateParticipantId = action.availableAlternates[0].participantId;
  const methods = [
    {
      params: { ...action.payload, alternateParticipantId },
      method: action.method
    }
  ];
  mutationRequest({ methods, callback: postMutation });
}

function swapPositions({ action, callback }) {
  const postMutation = (result) => (result.success ? callback() : console.log({ result }));
  const drawPosition = action.availableAssignments[0].drawPosition;
  action.payload.drawPositions.push(drawPosition);
  const methods = [
    {
      params: { ...action.payload },
      method: action.method
    }
  ];
  mutationRequest({ methods, callback: postMutation });
}
