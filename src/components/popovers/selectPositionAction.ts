/**
 * Select position action popover for draw assignments.
 * Provides actions for assigning, withdrawing, seeding, swapping participants.
 */
import { validators } from 'courthive-components';
import { selectParticipant } from 'components/modals/selectParticipant';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tipster } from 'components/popovers/tipster';
import { tools } from 'tods-competition-factory';

const actionLabels: Record<string, string> = {
  ALTERNATE: 'Assign alternate',
  ASSIGN: 'Assign participant',
  BYE: 'Assign BYE',
  REMOVE_PARTICIPANT: 'Remove assignment',
  REMOVE: 'Remove assignment',
  QUALIFIER: 'Assign qualifier',
  LUCKY: 'Assign Lucky Loser',
  SEED_VALUE: 'Assign seed',
  SWAP: 'Swap draw positions',
  WITHDRAW: 'Withdraw participant',
};

export function selectPositionAction({ pointerEvent, actions, callback }: { pointerEvent: PointerEvent; actions: any[]; callback: () => void }): void {
  const target = pointerEvent.target as HTMLElement;
  const handleClick = (action: any) => {
    if (['WITHDRAW', 'BYE', 'REMOVE', 'REMOVE_PARTICIPANT'].includes(action.type)) noChoiceAction({ action, callback });
    if (['ASSIGN', 'ALTERNATE', 'SWAP', 'QUALIFIER', 'LUCKY'].includes(action.type))
      assignParticipant({ action, callback });
    if (['SEED_VALUE'].includes(action.type)) assignSeed({ target, action, callback });
  };
  const options = actions
    ?.filter(({ type }) => actionLabels[type])
    .map((action) => ({
      option: actionLabels[action.type] || action.type,
      onClick: () => handleClick(action),
    }));

  if (options?.length) tipster({ options, target, config: { arrow: false, offset: [0, 0] } });
}

function noChoiceAction({ action, callback }: { action: any; callback: () => void }) {
  const postMutation = (result: any) => (result.success ? callback() : console.log({ result }));
  const methods = [{ method: action.method, params: action.payload }];
  mutationRequest({ methods, callback: postMutation });
}

function assignParticipant({ action, callback }: { action: any; callback: () => void }) {
  const onSelection = (params: any) => {
    const postMutation = (result: any) => (result.success ? callback() : console.log({ result }));
    const methods = [
      {
        params: { ...action.payload, ...params },
        method: action.method,
      },
    ];
    mutationRequest({ methods, callback: postMutation });
  };

  (selectParticipant as any)({ action, onSelection, selectOnEnter: true });
}

function assignSeed({ target, action, callback }: { target: HTMLElement; action: any; callback: () => void }) {
  let tip: any;

  function onKeyDown(e: KeyboardEvent) {
    if (e?.key === 'Enter') {
      const seedValue = (e.target as HTMLInputElement).value;
      if (tools.isConvertableInteger(seedValue)) {
        const postMutation = (result: any) => (result.success ? callback() : console.log({ result }));
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
      validator: validators.numericValidator,
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
