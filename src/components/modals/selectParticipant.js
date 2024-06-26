import { createSelectionTable } from 'components/tables/selection/createSelectionTable';
import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { positionActionConstants } from 'tods-competition-factory';
import { controlBar } from 'components/controlBar/controlBar';
import { closeModal, openModal } from './baseModal/baseModal';
import { context } from 'services/context';

import { LEFT } from 'constants/tmxConstants';

const { ALTERNATE_PARTICIPANT, ASSIGN_PARTICIPANT, LUCKY_PARTICIPANT, QUALIFYING_PARTICIPANT, SWAP_PARTICIPANTS } =
  positionActionConstants;

const actionTypes = {
  [ALTERNATE_PARTICIPANT]: {
    selections: 'availableAlternates',
    targetAttribute: 'participantId',
    param: 'alternateParticipantId',
    title: 'Assign alternate',
  },
  [ASSIGN_PARTICIPANT]: {
    selections: 'participantsAvailable',
    targetAttribute: 'participantId',
    title: 'Select participant',
  },
  [LUCKY_PARTICIPANT]: {
    selections: 'availableLuckyLosers',
    targetAttribute: 'participantId',
    param: 'luckyLoserParticipantId',
    title: 'Assign lucky loser',
  },
  [QUALIFYING_PARTICIPANT]: {
    selections: 'qualifyingParticipants',
    targetAttribute: 'participantId',
    param: 'qualifyingParticipantId',
    title: 'Assign qualifier',
  },
  [SWAP_PARTICIPANTS]: {
    selections: ['availableAssignments', 'swappableParticipants'],
    targetAttribute: 'drawPosition',
    title: 'Swap draw positions',
    param: 'drawPositions',
  },
  selectParticipants: {
    selections: 'participantsAvailable',
    targetAttribute: 'participantId',
    title: 'Select participants',
  },
};

export function selectParticipant(params) {
  const { selectedParticipantIds, selectionLimit, activeOnEnter, selectOnEnter, onSelection, update, action } = params;
  const actionType = actionTypes[action.type];
  if (!actionType?.targetAttribute) return;

  const title = params.title || actionType.title || 'Select participant';
  let selected, controlInputs;

  const onClick = () => {
    const attribute = actionType.targetAttribute;
    const param = actionType.param || actionType.targetAttribute;
    const value = Array.isArray(selected) ? selected[0]?.[attribute] : selected?.[attribute];
    if (action.type === 'SWAP') {
      if (value) {
        action.payload.drawPositions.push(value);
        onSelection({ [param]: action.payload.drawPositions });
      } else if (selected?.length === 1) {
        const participantId = selected?.[0]?.participantId;
        action.payload.participantIds.push(participantId);
        onSelection({ participantIds: action.payload.participantIds });
      }
    } else if (value) {
      onSelection({ [param]: value, selected });
    }
  };

  const controlId = 'selectionControl';
  const anchorId = 'selectionTable';
  const buttons = [
    { label: 'Cancel', intent: 'is-none', close: true },
    // [Select] button will be hidden if only one item is being selected
    { hide: selectionLimit === 1, label: 'Select', intent: 'is-info', onClick, close: true },
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

  if (update) {
    update({ title, content, buttons, onClose });
  } else {
    openModal({ title, content, buttons, onClose });
  }

  const onSelected = (value) => {
    selected = value;
    if (selectionLimit && selected?.length === selectionLimit) {
      closeModal();
      onClick();
    }
  };
  const data = Array.isArray(actionType.selections)
    ? action[actionType.selections.find((s) => action[s])]
    : action[actionType.selections];
  const { table } = createSelectionTable({
    selectedParticipantIds, // already selected
    targetAttribute: actionType.targetAttribute,
    selectionLimit,
    onSelected,
    anchorId,
    data,
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
      focus: true,
    },
  ];

  const target = document.getElementById(controlId);

  controlInputs = controlBar({ table, target, items }).inputs;
}
