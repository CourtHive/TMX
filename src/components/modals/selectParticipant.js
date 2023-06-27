import { createSelectionTable } from 'components/tables/selection/createSelectionTable';
import { destroyTable } from 'Pages/Tournament/destroyTable';
import { context } from 'services/context';

const actionTypes = {
  ALTERNATE: {
    selections: 'availableAlternates',
    targetAttribute: 'participantId',
    param: 'alternateParticipantId',
    title: 'Assign alternate'
  },
  ASSIGN: { title: 'Select participant', targetAttribute: 'participantId', selections: 'participantsAvailable' },
  SWAP: {
    selections: 'availableAssignments',
    targetAttribute: 'drawPosition',
    title: 'Swap draw positions',
    param: 'drawPositions'
  }
};

export function selectParticipant({ action, onSelection }) {
  const actionType = actionTypes[action.type];
  if (!actionType?.targetAttribute) return;
  let selected;

  const onClick = () => {
    const attribute = actionType.targetAttribute;
    const param = actionType.param || actionType.targetAttribute;
    const value = selected?.[attribute];
    if (value) {
      if (action.type === 'SWAP') {
        action.payload.drawPositions.push(value);
        onSelection({ [param]: action.payload.drawPositions });
      } else {
        onSelection({ [param]: value });
      }
    }
  };

  const anchorId = 'selectionTable';
  const buttons = [
    { label: 'Cancel', intent: 'is-none', close: true },
    { label: 'Select', intent: 'is-info', onClick, close: true }
  ];
  const onClose = () => destroyTable({ anchorId });
  const content = `<div id='${anchorId}'></div>`;

  context.modal.open({ title: 'Select participant', content, buttons, onClose });

  const onSelected = (value) => (selected = value);
  const data = action[actionType.selections];
  createSelectionTable({ anchorId, actionType, data, onSelected });
}
