import { selectParticipant } from 'components/modals/selectParticipant';
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
    ['ASSIGN', 'ALTERNATE', 'SWAP'].includes(action.type) && assignParticipant({ action, callback });
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
  const onSelection = (params) => {
    const postMutation = (result) => (result.success ? callback() : console.log({ result }));
    const methods = [
      {
        params: { ...action.payload, ...params },
        method: action.method
      }
    ];
    mutationRequest({ methods, callback: postMutation });
  };

  selectParticipant({ action, onSelection });
}
