/**
 * Draw form relationships and field interactions.
 * Manages form field dependencies and dynamic updates for draw creation.
 */
import { drawDefinitionConstants, tournamentEngine, tools } from 'tods-competition-factory';
import { getChildrenByClassName } from 'services/dom/parentAndChild';
import { renderOptions, validators } from 'courthive-components';
import { removeAllChildNodes } from 'services/dom/transformers';
import { acceptedEntriesCount } from './acceptedEntriesCount';

const { FEED_IN, LUCKY_DRAW, MAIN, QUALIFYING, ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF } = drawDefinitionConstants;
import {
  ADVANCE_PER_GROUP,
  AUTOMATED,
  DRAW_NAME,
  DRAW_SIZE,
  DRAW_TYPE,
  GROUP_REMAINING,
  GROUP_SIZE,
  MANUAL,
  NONE,
  PLAYOFF_TYPE,
  QUALIFIERS_COUNT,
  STRUCTURE_NAME,
  TOP_FINISHERS,
} from 'constants/tmxConstants';

interface FormRelationshipParams {
  isQualifying?: boolean;
  maxQualifiers?: number;
  drawId?: string;
  event: any;
}

interface FormInteractionParams {
  fields?: Record<string, HTMLElement>;
  inputs: Record<string, any>;
  drawType?: string;
  drawId?: string;
  stage?: string;
  name?: string;
  event?: any;
  e?: Event;
}

export function getDrawFormRelationships({
  isQualifying,
  maxQualifiers,
  drawId,
  event,
}: FormRelationshipParams): any[] {
  const stage = isQualifying ? QUALIFYING : MAIN;

  const checkCreationMethod = ({ fields, inputs }: FormInteractionParams) => {
    const drawSizeValue = inputs[DRAW_SIZE].value || 0;
    const drawSize = validators.numericValidator(drawSizeValue) ? Number.parseInt(drawSizeValue) : 0;
    const entriesCount = acceptedEntriesCount({ drawId, event, stage });
    const qualifiersValue = inputs['qualifiersCount'].value || 0;
    const qualifiersCount = validators.numericValidator(qualifiersValue) ? Number.parseInt(qualifiersValue) : 0;
    const manualOnly =
      maxQualifiers || (isQualifying && drawSize < entriesCount) || drawSize < entriesCount + qualifiersCount;
    if (manualOnly) inputs[AUTOMATED].value = MANUAL;
    const help = fields && getChildrenByClassName(fields[AUTOMATED], 'help')?.[0];
    if (help) help.style.display = manualOnly ? '' : NONE;
    for (const option of inputs[AUTOMATED].options) {
      if (option.label === AUTOMATED) {
        option.disabled = manualOnly;
      }
    }
  };

  const updateDrawSize = ({ drawType, drawId, fields, inputs }: FormInteractionParams): number => {
    const entriesCount = maxQualifiers ? inputs[DRAW_SIZE].value : acceptedEntriesCount({ drawId, event, stage });
    const qualifiersValue = inputs['qualifiersCount'].value || 1;
    const qualifiersCount =
      (validators.numericValidator(qualifiersValue) && Number.parseInt(qualifiersValue)) || maxQualifiers ? 1 : 0;
    const drawSizeInteger =
      isQualifying && !maxQualifiers ? entriesCount : Number.parseInt(entriesCount) + qualifiersCount;
    const drawSize =
      ((maxQualifiers || [LUCKY_DRAW, FEED_IN, ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF].includes(drawType)) &&
        drawSizeInteger) ||
      tools.nextPowerOf2(drawSizeInteger);
    inputs[DRAW_SIZE].value = drawSize;

    checkCreationMethod({ fields, inputs });
    return drawSize;
  };

  const qualifiersCountChange = ({ fields, inputs }: FormInteractionParams) => {
    let drawSize = Number.parseInt(inputs[DRAW_SIZE].value);
    const enteredValue = inputs['qualifiersCount'].value;
    if (validators.numericValidator(enteredValue) && Number.parseInt(enteredValue) < 1) {
      inputs['qualifiersCount'].value = maxQualifiers ? 1 : 0;
    }
    const generateButton = document.getElementById('generateDraw') as HTMLButtonElement;
    let qualifiersValue = inputs['qualifiersCount'].value;
    if (generateButton) generateButton.disabled = false;

    if (
      maxQualifiers &&
      validators.numericValidator(qualifiersValue) &&
      Number.parseInt(qualifiersValue) > maxQualifiers
    ) {
      inputs['qualifiersCount'].value = maxQualifiers;
    } else if (!maxQualifiers) {
      const drawType = inputs[DRAW_TYPE].value;
      drawSize = updateDrawSize({ drawId, drawType, fields, inputs });
    }

    qualifiersValue = inputs['qualifiersCount'].value;
    if (
      generateButton &&
      (!validators.numericValidator(qualifiersValue) || drawSize <= Number.parseInt(qualifiersValue))
    ) {
      generateButton.disabled = true;
    }
  };

  const drawTypeChange = ({ e, fields, inputs }: FormInteractionParams) => {
    const playoffType = inputs[PLAYOFF_TYPE].value;
    const drawType = (e!.target as HTMLSelectElement).value;

    if (!maxQualifiers) updateDrawSize({ drawId, drawType, fields, inputs });
    checkCreationMethod({ fields, inputs });

    if (fields) {
      fields[ADVANCE_PER_GROUP].style.display =
        drawType === ROUND_ROBIN_WITH_PLAYOFF && playoffType === TOP_FINISHERS ? '' : NONE;
      fields[PLAYOFF_TYPE].style.display = drawType === ROUND_ROBIN_WITH_PLAYOFF ? '' : NONE;
      const groupSizeVisible = [ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF].includes(drawType);
      fields[GROUP_SIZE].style.display = groupSizeVisible ? '' : NONE;
    }
  };

  const drawSizeChange = ({ fields, inputs }: FormInteractionParams) => {
    const generateButton = document.getElementById('generateDraw') as HTMLButtonElement;
    const drawSizeValue = inputs[DRAW_SIZE].value || 0;
    const drawSize = validators.numericValidator(drawSizeValue) ? Number.parseInt(drawSizeValue) : 0;
    const entriesCount = acceptedEntriesCount({ drawId, event, stage });
    const maxDrawSize = Math.max(tools.nextPowerOf2(entriesCount), 512);
    const valid = validators.numericRange(2, maxDrawSize)(drawSizeValue);
    if (generateButton) generateButton.disabled = !valid;
    const { validGroupSizes } = tournamentEngine.getValidGroupSizes({ drawSize, groupSizeLimit: 8 });
    const options = validGroupSizes.map((size: number) => ({ label: size, value: size }));
    const groupSizeSelect = inputs[GROUP_SIZE];
    const value = validGroupSizes.includes(drawSize) ? 4 : validGroupSizes[0];
    removeAllChildNodes(groupSizeSelect);
    renderOptions(groupSizeSelect, { options, value });
    checkCreationMethod({ fields, inputs });
  };

  const playoffTypeChange = ({ e, fields }: FormInteractionParams) => {
    const playoffType = (e!.target as HTMLSelectElement).value;
    if (fields) {
      fields[ADVANCE_PER_GROUP].style.display = playoffType === TOP_FINISHERS ? '' : NONE;
      fields[GROUP_REMAINING].style.display = playoffType === TOP_FINISHERS ? '' : NONE;
    }
  };

  const groupSizeChange = ({ inputs }: FormInteractionParams) => {
    const newGroupSize = Number.parseInt(inputs[GROUP_SIZE].value);
    const existingOptions = inputs[ADVANCE_PER_GROUP].options;
    const existingValues = Array.from(existingOptions).map((o: any) => Number.parseInt(o.value));
    const maxValue = Math.max(...existingValues);
    if (maxValue > newGroupSize) {
      tools
        .generateRange(newGroupSize + 1, maxValue + 1)
        .reverse()
        .forEach((v) => {
          inputs[ADVANCE_PER_GROUP].remove(v - 2);
        });
    } else if (maxValue < newGroupSize) {
      tools
        .generateRange(maxValue + 1, newGroupSize + 1)
        .forEach((v) => inputs[ADVANCE_PER_GROUP].add(new Option(v.toString(), v.toString())));
    }
  };

  const structureNameChange = ({ inputs, name }: FormInteractionParams) => {
    const newStructureName = inputs[name!].value;
    const generateButton = document.getElementById('generateDraw') as HTMLButtonElement;
    const valid = validators.nameValidator(4)(newStructureName);
    if (generateButton) generateButton.disabled = !valid;
  };

  return [
    {
      onInput: ({ inputs }: FormInteractionParams) => structureNameChange({ inputs, name: DRAW_NAME }),
      control: DRAW_NAME,
    },
    {
      onInput: ({ inputs }: FormInteractionParams) => structureNameChange({ inputs, name: STRUCTURE_NAME }),
      control: STRUCTURE_NAME,
    },
    {
      onChange: groupSizeChange,
      control: GROUP_SIZE,
    },
    {
      onChange: drawTypeChange,
      control: DRAW_TYPE,
    },
    {
      onChange: playoffTypeChange,
      control: PLAYOFF_TYPE,
    },
    {
      onInput: drawSizeChange,
      control: DRAW_SIZE,
    },
    {
      onInput: qualifiersCountChange,
      control: QUALIFIERS_COUNT,
    },
  ];
}
