import { drawDefinitionConstants, drawEngine, utilities } from 'tods-competition-factory';
import { numericValidator } from 'components/validators/numericValidator';
import { getChildrenByClassName } from 'services/dom/parentAndChild';
import { renderOptions } from 'components/renderers/renderField';
import { removeAllChildNodes } from 'services/dom/transformers';
import { acceptedEntriesCount } from './acceptedEntriesCount';

const { FEED_IN, LUCKY_DRAW, MAIN, QUALIFYING, ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF } = drawDefinitionConstants;
import {
  ADVANCE_PER_GROUP,
  AUTOMATED,
  DRAW_SIZE,
  DRAW_TYPE,
  GROUP_REMAINING,
  GROUP_SIZE,
  MANUAL,
  NONE,
  PLAYOFF_TYPE,
  QUALIFIERS_COUNT,
  TOP_FINISHERS
} from 'constants/tmxConstants';

export function getFormRelationships({ event, isQualifying, maxQualifiers }) {
  const stage = isQualifying ? QUALIFYING : MAIN;
  const checkCreationMethod = ({ fields, inputs }) => {
    const drawSizeValue = inputs[DRAW_SIZE].value || 0;
    const drawSize = numericValidator(drawSizeValue) ? parseInt(drawSizeValue) : 0;
    const entriesCount = acceptedEntriesCount(event, stage);
    const qualifiersValue = inputs['qualifiersCount'].value || 0;
    const qualifiersCount = numericValidator(qualifiersValue) ? parseInt(qualifiersValue) : 0;
    const manualOnly =
      maxQualifiers || (isQualifying && drawSize < entriesCount) || drawSize < entriesCount + qualifiersCount;
    if (manualOnly) inputs[AUTOMATED].value = MANUAL;
    const help = getChildrenByClassName(fields[AUTOMATED], 'help')?.[0];
    help.style.display = manualOnly ? '' : NONE;
    for (const option of inputs[AUTOMATED].options) {
      if (option.label === AUTOMATED) {
        option.disabled = manualOnly;
      }
    }
  };

  const updateDrawSize = ({ drawType, fields, inputs }) => {
    const entriesCount = maxQualifiers ? inputs[DRAW_SIZE].value : acceptedEntriesCount(event, stage);
    const qualifiersValue = inputs['qualifiersCount'].value || 1;
    const qualifiersCount = (numericValidator(qualifiersValue) && parseInt(qualifiersValue)) || maxQualifiers ? 1 : 0;
    const drawSizeInteger = isQualifying && !maxQualifiers ? entriesCount : parseInt(entriesCount) + qualifiersCount;
    const drawSize =
      ((maxQualifiers || [LUCKY_DRAW, FEED_IN, ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF].includes(drawType)) &&
        drawSizeInteger) ||
      utilities.nextPowerOf2(drawSizeInteger);
    inputs[DRAW_SIZE].value = drawSize;

    checkCreationMethod({ fields, inputs });
  };

  const qualifiersCountChange = ({ fields, inputs }) => {
    const enteredValue = inputs['qualifiersCount'].value;
    if (numericValidator(enteredValue) && parseInt(enteredValue) < 1) {
      inputs['qualifiersCount'].value = maxQualifiers ? 1 : 0;
    }
    const qualifiersValue = inputs['qualifiersCount'].value;
    if (maxQualifiers && numericValidator(qualifiersValue) && parseInt(qualifiersValue) > maxQualifiers) {
      inputs['qualifiersCount'].value = maxQualifiers;
    } else if (!maxQualifiers) {
      const drawType = inputs[DRAW_TYPE].value;
      updateDrawSize({ drawType, fields, inputs });
    }
  };

  const drawTypeChange = ({ e, fields, inputs }) => {
    const playoffType = inputs[PLAYOFF_TYPE].value;
    const drawType = e.target.value;

    if (!maxQualifiers) updateDrawSize({ drawType, fields, inputs });
    checkCreationMethod({ fields, inputs });

    fields[ADVANCE_PER_GROUP].style.display =
      drawType === ROUND_ROBIN_WITH_PLAYOFF && playoffType === TOP_FINISHERS ? '' : NONE;
    fields[PLAYOFF_TYPE].style.display = drawType === ROUND_ROBIN_WITH_PLAYOFF ? '' : NONE;
    const groupSizeVisible = [ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF].includes(drawType);
    fields[GROUP_SIZE].style.display = groupSizeVisible ? '' : NONE;
  };

  const drawSizeChange = ({ fields, inputs }) => {
    const drawSizeValue = inputs[DRAW_SIZE].value || 0;
    const drawSize = numericValidator(drawSizeValue) ? parseInt(drawSizeValue) : 0;
    const { validGroupSizes } = drawEngine.getValidGroupSizes({ drawSize, groupSizeLimit: 8 });
    const options = validGroupSizes.map((size) => ({ label: size, value: size }));
    const groupSizeSelect = inputs[GROUP_SIZE];
    const value = validGroupSizes.includes(drawSize) ? 4 : validGroupSizes[0];
    removeAllChildNodes(groupSizeSelect);
    renderOptions(groupSizeSelect, { options, value });
    checkCreationMethod({ fields, inputs });
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
      control: GROUP_SIZE
    },
    {
      onChange: drawTypeChange,
      control: DRAW_TYPE
    },
    {
      onChange: playoffTypeChange,
      control: PLAYOFF_TYPE
    },
    {
      onInput: drawSizeChange,
      control: DRAW_SIZE
    },
    {
      onInput: qualifiersCountChange,
      control: QUALIFIERS_COUNT
    }
  ];
}
