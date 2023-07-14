import { drawDefinitionConstants, drawEngine, utilities } from 'tods-competition-factory';
import { renderOptions } from 'components/renderers/renderField';
import { removeAllChildNodes } from 'services/dom/transformers';

import {
  ADVANCE_PER_GROUP,
  DRAW_SIZE,
  GROUP_REMAINING,
  GROUP_SIZE,
  NONE,
  PLAYOFF_TYPE,
  TOP_FINISHERS
} from 'constants/tmxConstants';

const { ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF } = drawDefinitionConstants;

export function getFormRelationships() {
  const drawTypeChange = ({ e, fields, inputs }) => {
    const playoffType = inputs[PLAYOFF_TYPE].value;
    const drawType = e.target.value;

    fields[ADVANCE_PER_GROUP].style.display =
      drawType === ROUND_ROBIN_WITH_PLAYOFF && playoffType === TOP_FINISHERS ? '' : NONE;
    fields[PLAYOFF_TYPE].style.display = drawType === ROUND_ROBIN_WITH_PLAYOFF ? '' : NONE;
    const groupSizeVisible = [ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF].includes(drawType);
    fields[GROUP_SIZE].style.display = groupSizeVisible ? '' : NONE;
  };

  const drawSizeChange = ({ inputs }) => {
    const drawSize = inputs[DRAW_SIZE].value;
    const { validGroupSizes } = drawEngine.getValidGroupSizes({ drawSize, groupSizeLimit: 8 });
    const options = validGroupSizes.map((size) => ({ label: size, value: size }));
    const groupSizeSelect = inputs[GROUP_SIZE];
    const value = validGroupSizes.includes(4) ? 4 : validGroupSizes[0];
    removeAllChildNodes(groupSizeSelect);
    renderOptions(groupSizeSelect, { options, value });
  };

  const playoffTypeChange = ({ e, fields }) => {
    const playoffType = e.target.value;
    fields[ADVANCE_PER_GROUP].style.display = playoffType === TOP_FINISHERS ? '' : NONE;
    fields[GROUP_REMAINING].style.display = playoffType === TOP_FINISHERS ? '' : NONE;
  };

  const groupSizeChange = ({ inputs }) => {
    const newGroupSize = parseInt(inputs[GROUP_SIZE].value);
    const existingOptions = inputs[ADVANCE_PER_GROUP].options;
    const existingValues = Array.from(existingOptions).map((o) => parseInt(o.value));
    const maxValue = Math.max(...existingValues);
    if (maxValue > newGroupSize) {
      utilities
        .generateRange(newGroupSize + 1, maxValue + 1)
        .reverse() // must remove from the bottom up
        .forEach((v) => {
          inputs[ADVANCE_PER_GROUP].remove(v - 2);
        }); // list starts at 2
    } else if (maxValue < newGroupSize) {
      utilities
        .generateRange(maxValue + 1, newGroupSize + 1)
        .forEach((v) => inputs[ADVANCE_PER_GROUP].add(new Option(v, v)));
    }
  };

  return [
    {
      onChange: groupSizeChange,
      control: 'groupSize'
    },
    {
      onChange: drawTypeChange,
      control: 'drawType'
    },
    {
      onChange: playoffTypeChange,
      control: PLAYOFF_TYPE
    },
    {
      onChange: drawSizeChange,
      control: DRAW_SIZE
    }
  ];
}
