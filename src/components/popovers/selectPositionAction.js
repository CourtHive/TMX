import { numericValidator } from 'components/validators/numericValidator';
import { selectParticipant } from 'components/modals/selectParticipant';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tipster } from 'components/popovers/tipster';
import { tools } from 'tods-competition-factory';

const actionLabels = {
  ALTERNATE: 'Assign alternate',
  ASSIGN: 'Assign participant',
  BYE: 'Assign BYE',
  REMOVE_PARTICIPANT: 'Remove assignment',
  REMOVE: 'Remove assignment',
  QUALIFIER: 'Assign qualifier',
  LUCKY: 'Assign Lucky Loser',
  // REMOVE_SEED: 'Remove seed', // TODO: implement
  // PENALTY: 'Assign penalty', // TODO: implement
  SEED_VALUE: 'Assign seed',
  SWAP: 'Swap draw positions',
  WITHDRAW: 'Withdraw participant',
};

export function selectPositionAction({ pointerEvent, actions, callback }) {
  const target = pointerEvent.target;
  const handleClick = (action) => {
    ['WITHDRAW', 'BYE', 'REMOVE', 'REMOVE_PARTICIPANT'].includes(action.type) && noChoiceAction({ action, callback });
    ['ASSIGN', 'ALTERNATE', 'SWAP', 'QUALIFIER', 'LUCKY'].includes(action.type) &&
      assignParticipant({ action, callback });
    ['SEED_VALUE'].includes(action.type) && assignSeed({ target, action, callback });
  };
  const options = actions
    ?.filter(({ type }) => actionLabels[type])
    .map((action) => ({
      option: actionLabels[action.type] || action.type,
      onClick: () => handleClick(action),
    }));

  if (options?.length) tipster({ options, target, config: { arrow: false, offset: [0, 0] } });
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
        method: action.method,
      },
    ];
    mutationRequest({ methods, callback: postMutation });
  };

  selectParticipant({ action, onSelection, selectOnEnter: true });
}

function assignSeed({ target, action, callback }) {
  let tip;

  function onKeyDown(e) {
    if (e?.key === 'Enter') {
      const seedValue = e.target.value;
      if (tools.isConvertableInteger(seedValue)) {
        const postMutation = (result) => (result.success ? callback() : console.log({ result }));
        const methods = [
          {
            params: { ...action.payload, seedValue },
            method: action.method,
          },
        ];
        mutationRequest({ methods, callback: postMutation });
      }
      tip.destroy();
    }
  }
  const menuItems = [
    {
      label: 'Assign seed number ',
      validator: numericValidator,
      placeholder: 'Seed number',
      field: 'seedNumber',
      id: 'seedNumber',
      type: 'input',
      focus: true,
      onKeyDown,
    },
  ];

  tip = tipster({ menuItems, target, config: { arrow: false, offset: [0, 0] } });
}
