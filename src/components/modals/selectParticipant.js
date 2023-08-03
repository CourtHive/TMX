import { createSelectionTable } from 'components/tables/selection/createSelectionTable';
import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { positionActionConstants } from 'tods-competition-factory';
import { controlBar } from 'components/controlBar/controlBar';
import { closeModal, openModal } from './baseModal/baseModal';
import { context } from 'services/context';

import { LEFT } from 'constants/tmxConstants';

const { ALTERNATE_PARTICIPANT, ASSIGN_PARTICIPANT, QUALIFYING_PARTICIPANT, SWAP_PARTICIPANTS } =
  positionActionConstants;

const actionTypes = {
  [ALTERNATE_PARTICIPANT]: {
    selections: 'availableAlternates',
    targetAttribute: 'participantId',
    param: 'alternateParticipantId',
    title: 'Assign alternate'
  },
  [ASSIGN_PARTICIPANT]: {
    selections: 'participantsAvailable',
    targetAttribute: 'participantId',
    title: 'Select participant'
  },
  [QUALIFYING_PARTICIPANT]: {
    selections: 'qualifyingParticipants',
    targetAttribute: 'participantId',
    param: 'qualifyingParticipantId',
    title: 'Assign qualifier'
  },
  [SWAP_PARTICIPANTS]: {
    selections: 'availableAssignments',
    targetAttribute: 'drawPosition',
    title: 'Swap draw positions',
    param: 'drawPositions'
  },
  selectParticipants: {
    selections: 'participantsAvailable',
    targetAttribute: 'participantId',
    title: 'Select participants'
  }
};

export function selectParticipant({
  title = 'Select participant',
  selectedParticipantIds,
  selectionLimit,
  activeOnEnter,
  selectOnEnter,
  onSelection,
  action
}) {
  const actionType = actionTypes[action.type];
  if (!actionType?.targetAttribute) return;
  let selected, controlInputs;

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

  openModal({ title, content, buttons, onClose });

  const onSelected = (value) => (selected = value);
  const data = action[actionType.selections];
  const { table } = createSelectionTable({
    selectedParticipantIds, // already selected
    targetAttribute: actionType.targetAttribute,
    selectionLimit,
    onSelected,
    anchorId,
    data
  });

  const setSearchFilter = createSearchFilter(table);
  const checkSelection = () => {
    const active = table.getData('active');
    if (active.length === 1) {
      if (selectOnEnter) {
        selected = active[0];
        closeModal();
        onClick();
      } else if (activeOnEnter) {
        const selectedIds = selected?.map((s) => s.participantId) || [];
        const activeId = active[0].participantId;
        if (!selectedIds.includes(activeId)) {
          if (Array.isArray(selected)) {
            selected.push(active[0]);
          } else {
            selected = active;
          }
          table.selectRow([activeId]);
          controlInputs['participantSearch'].value = '';
        }
      }
    }
  };

  const onSearchKeyDown = (e) => {
    e.keyCode === 8 && e.target.value.length === 1 && setSearchFilter('');
    e.key === 'Enter' && checkSelection();
  };
  const items = [
    {
      onKeyDown: onSearchKeyDown,
      onChange: (e) => setSearchFilter(e.target.value),
      onKeyUp: (e) => setSearchFilter(e.target.value),
      clearSearch: () => setSearchFilter(''),
      placeholder: 'Search entries',
      id: 'participantSearch',
      location: LEFT,
      search: true,
      focus: true
    }
  ];

  const target = document.getElementById(controlId);

  controlInputs = controlBar({ table, target, items }).inputs;
}
