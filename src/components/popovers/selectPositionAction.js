import { tipster } from 'components/popovers/tipster';
import { mutationRequest } from 'services/mutation/mutationRequest';

const actionLabels = {
  ALTERNATE: 'Assign alternate',
  ASSIGN: 'Assign participant',
  SWAP: 'Swap draw positions',
  REMOVE: 'Remove assignment',
  WITHDRAW: 'Withdraw participant',
  BYE: 'Assign Bye'
};

export function selectPositionAction({ event, actions, callback }) {
  const handleClick = (action) => {
    ['WITHDRAW', 'BYE'].includes(action.type) && noChoiceAction({ action, callback });
  };
  const options = actions
    // ?.filter(({ type }) => actionLabels[type])
    .map((action) => ({
      option: actionLabels[action.type] || action.type,
      onClick: () => handleClick(action)
    }));

  const target = event.target;
  tipster({ options, target, config: { arrow: false, offset: [0, 0] } });
}

function noChoiceAction({ action, callback }) {
  const postMutation = (result) => {
    if (result.success) callback();
  };
  const methods = [
    {
      method: action.method,
      params: action.payload
    }
  ];
  mutationRequest({ methods, callback: postMutation });
}
