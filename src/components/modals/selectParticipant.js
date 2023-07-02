import { createSelectionTable } from 'components/tables/selection/createSelectionTable';
import { positionActionConstants } from 'tods-competition-factory';
import { controlBar } from 'components/controlBar/controlBar';
import { context } from 'services/context';

import { LEFT } from 'constants/tmxConstants';

const { ALTERNATE_PARTICIPANT, ASSIGN_PARTICIPANT, SWAP_PARTICIPANTS } = positionActionConstants;

const actionTypes = {
  [ALTERNATE_PARTICIPANT]: {
    selections: 'availableAlternates',
    targetAttribute: 'participantId',
    param: 'alternateParticipantId',
    title: 'Assign alternate'
  },
  [ASSIGN_PARTICIPANT]: {
    title: 'Select participant',
    targetAttribute: 'participantId',
    selections: 'participantsAvailable'
  },
  [SWAP_PARTICIPANTS]: {
    selections: 'availableAssignments',
    targetAttribute: 'drawPosition',
    title: 'Swap draw positions',
    param: 'drawPositions'
  }
};

export function selectParticipant({ action, onSelection, selectionLimit, selectedParticipantIds }) {
  const actionType = actionTypes[action.type];
  if (!actionType?.targetAttribute) return;
  let selected;

  !!selectionLimit;
  !!selectedParticipantIds;

  const onClick = () => {
    const attribute = actionType.targetAttribute;
    const param = actionType.param || actionType.targetAttribute;
    const value = Array.isArray(selected) ? selected[0]?.[attribute] : selected?.[attribute];
    if (value) {
      if (action.type === 'SWAP') {
        action.payload.drawPositions.push(value);
        onSelection({ [param]: action.payload.drawPositions });
      } else {
        onSelection({ [param]: value, selected });
      }
    }
  };

  const controlId = 'selectionControl';
  const anchorId = 'selectionTable';
  const buttons = [
    { label: 'Cancel', intent: 'is-none', close: true },
    { label: 'Select', intent: 'is-info', onClick, close: true }
  ];
  const onClose = () => {
    const table = context.tables['selectionTable'];
    table?.destroy();

    delete context.tables['selectionTable'];
  };
  const content = `
    <div style='min-height: 420px'>
      <div id='${controlId}'></div>
      <div id='${anchorId}'></div>
    </div>
  `;

  context.modal.open({ title: 'Select participant', content, buttons, onClose });

  const onSelected = (value) => (selected = value);
  const data = action[actionType.selections];
  const { table } = createSelectionTable({
    selectedParticipantIds, // already selected
    selectionLimit,
    onSelected,
    actionType,
    anchorId,
    data
  });

  let searchText;
  const searchFilter = (rowData) => rowData.searchText?.includes(searchText);
  const updateSearchFilter = (value) => {
    if (!value) table.removeFilter(searchFilter);
    searchText = value?.toLowerCase();
    if (value) table.addFilter(searchFilter);
  };

  const target = document.getElementById(controlId);
  const items = [
    {
      onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateSearchFilter(''),
      onChange: (e) => updateSearchFilter(e.target.value),
      onKeyUp: (e) => updateSearchFilter(e.target.value),
      placeholder: 'Search entries',
      location: LEFT,
      search: true
    }
  ];
  controlBar({ table, target, items });
}
