/**
 * Select position action popover for draw assignments.
 * Provides actions for assigning, withdrawing, seeding, swapping participants.
 */
import { selectParticipant } from 'components/modals/selectParticipant';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tipster } from 'components/popovers/tipster';
import { validators } from 'courthive-components';
import { tools } from 'tods-competition-factory';

const actionLabels: Record<string, string> = {
  ALTERNATE: 'Assign alternate',
  ASSIGN: 'Assign participant',
  BYE: 'Assign BYE',
  NICKNAME: 'Set nickname',
  REMOVE_PARTICIPANT: 'Remove assignment',
  REMOVE: 'Remove assignment',
  QUALIFIER: 'Assign qualifier',
  LUCKY: 'Assign Lucky Loser',
  SEED_CASCADE: 'Withdraw seed (cascade)',
  SEED_VALUE: 'Assign seed',
  SWAP: 'Swap draw positions',
  WITHDRAW: 'Withdraw participant',
};

export function selectPositionAction({
  pointerEvent,
  actions,
  callback,
}: {
  pointerEvent: PointerEvent;
  actions: any[];
  callback: () => void;
}): void {
  const target = pointerEvent.target as HTMLElement;
  const handleClick = (action: any) => {
    if (['WITHDRAW', 'BYE', 'REMOVE', 'REMOVE_PARTICIPANT'].includes(action.type)) noChoiceAction({ action, callback });
    if (['ASSIGN', 'ALTERNATE', 'SWAP', 'QUALIFIER', 'LUCKY'].includes(action.type))
      assignParticipant({ action, callback });
    if (['SEED_CASCADE'].includes(action.type)) seedCascadeAction({ action, callback });
    if (['SEED_VALUE'].includes(action.type)) assignSeed({ target, action, callback });
    if (['NICKNAME'].includes(action.type)) assignNickname({ target, action, callback });
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

function seedCascadeAction({ action, callback }: { action: any; callback: () => void }) {
  const postMutation = (result: any) => {
    if (!result.success) return console.log({ result });

    const vacatedDrawPosition = result.results?.[0]?.vacatedDrawPosition;
    callback();

    if (vacatedDrawPosition) {
      requestAnimationFrame(() => highlightDrawPosition(vacatedDrawPosition));
    }
  };
  const methods = [{ method: action.method, params: action.payload }];
  mutationRequest({ methods, callback: postMutation });
}

export function highlightDrawPosition(drawPosition: number) {
  const el = document.querySelector(`.tmx-p[data-draw-position="${drawPosition}"]`) as HTMLElement;
  if (!el) return;

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('draw-position-highlight');
  setTimeout(() => el.classList.remove('draw-position-highlight'), 4000);
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

function assignNickname({ target, action, callback }: { target: HTMLElement; action: any; callback: () => void }) {
  let tip: any;

  function onKeyDown(e: KeyboardEvent) {
    if (e?.key === 'Enter') {
      const participantOtherName = (e.target as HTMLInputElement).value || undefined;
      const postMutation = (result: any) => (result.success ? callback() : console.log({ result }));
      const methods = [
        {
          params: { ...action.payload, participantOtherName },
          method: action.method,
        },
      ];
      mutationRequest({ methods, callback: postMutation });
      tip.destroy();
    }
  }
  const menuItems = [
    {
      label: 'Nickname ',
      placeholder: action.participant?.participantOtherName || 'Nickname',
      value: action.participant?.participantOtherName || '',
      field: 'nickname',
      id: 'nickname',
      type: 'input',
      focus: true,
      onKeyDown,
    },
  ];

  tip = tipster({ menuItems, target, config: { arrow: false, offset: [0, 0] } });
}
