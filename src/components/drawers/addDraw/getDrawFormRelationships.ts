/**
 * Draw form relationships and field interactions.
 * Manages form field dependencies and dynamic updates for draw creation.
 */
import { drawDefinitionConstants, tournamentEngine, tools } from 'tods-competition-factory';
import { getUserTopologiesSync } from 'pages/templates/topologyBridge';
import { getChildrenByClassName } from 'services/dom/parentAndChild';
import { renderOptions, validators } from 'courthive-components';
import { removeAllChildNodes } from 'services/dom/transformers';
import { acceptedEntriesCount } from './acceptedEntriesCount';
import { getTopologyTemplates } from './topologyTemplates';

const {
  AD_HOC,
  ADAPTIVE,
  FEED_IN,
  FEED_IN_CHAMPIONSHIP,
  LUCKY_DRAW,
  MAIN,
  PAGE_PLAYOFF,
  PLAY_OFF,
  QUALIFYING,
  ROUND_ROBIN,
  ROUND_ROBIN_WITH_PLAYOFF,
  SWISS,
} = drawDefinitionConstants;
import {
  ADVANCE_PER_GROUP,
  AUTOMATED,
  BEST_FINISHERS,
  DRAW_MATIC,
  DRAW_NAME,
  DRAW_SIZE,
  DRAW_TYPE,
  DYNAMIC_RATINGS,
  FIC_DEPTH,
  GROUP_REMAINING,
  GROUP_SIZE,
  MANUAL,
  NONE,
  PLAYOFF_DRAW_TYPE,
  PLAYOFF_GROUP_SIZE,
  PLAYOFF_TYPE,
  QUALIFIERS_COUNT,
  RATING_SCALE,
  ROUNDS_COUNT,
  SEEDING_POLICY,
  STRUCTURE_NAME,
  TEAM_AVOIDANCE,
  TOPOLOGY_TEMPLATE_PREFIX,
  TOP_FINISHERS,
  TOTAL_ADVANCE,
} from 'constants/tmxConstants';

/** Non-power-of-2 structure types that use raw draw size */
const NON_POW2_TYPES = new Set([
  ADAPTIVE,
  LUCKY_DRAW,
  FEED_IN,
  ROUND_ROBIN,
  ROUND_ROBIN_WITH_PLAYOFF,
  DRAW_MATIC,
  AD_HOC,
]);

/**
 * When drawType is a topology template reference, resolve the main node's
 * structureType so draw size coercion matches the actual structure.
 */
function resolveEffectiveDrawType(drawType: string): string {
  if (!drawType?.startsWith(TOPOLOGY_TEMPLATE_PREFIX)) return drawType;

  const templateName = drawType.slice(TOPOLOGY_TEMPLATE_PREFIX.length);
  const template =
    getTopologyTemplates().find((t) => t.name === templateName) ||
    getUserTopologiesSync().find((t) => t.name === templateName);

  const mainNode = template?.state?.nodes?.find((n: any) => n.stage === MAIN);
  return mainNode?.structureType || drawType;
}

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
    const effectiveType = resolveEffectiveDrawType(drawType as string);
    const drawSize =
      ((maxQualifiers || NON_POW2_TYPES.has(effectiveType)) && drawSizeInteger) || tools.nextPowerOf2(drawSizeInteger);
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

  const updateFicDepthOptions = (inputs: Record<string, any>) => {
    const drawSize = Number.parseInt(inputs[DRAW_SIZE]?.value) || 0;
    for (const option of inputs[FIC_DEPTH]?.options ?? []) {
      if (option.value === 'R16') option.disabled = drawSize <= 16;
      if (option.value === 'QF') option.disabled = drawSize <= 8;
      if (option.value === 'SF') option.disabled = drawSize <= 4;
    }
  };

  const updateFieldVisibility = (fields: Record<string, HTMLElement>, drawType: string, inputs: Record<string, any>) => {
    const playoffType = inputs[PLAYOFF_TYPE].value;
    const isRRPlayoff = drawType === ROUND_ROBIN_WITH_PLAYOFF;
    const isDrawMatic = drawType === DRAW_MATIC;
    const isAdHocType = drawType === AD_HOC || drawType === SWISS || isDrawMatic;
    const isFIC = drawType === FEED_IN_CHAMPIONSHIP;

    fields[ADVANCE_PER_GROUP].style.display = isRRPlayoff && playoffType === TOP_FINISHERS ? '' : NONE;
    fields[TOTAL_ADVANCE].style.display = isRRPlayoff && playoffType === BEST_FINISHERS ? '' : NONE;
    fields[GROUP_REMAINING].style.display =
      isRRPlayoff && (playoffType === TOP_FINISHERS || playoffType === BEST_FINISHERS) ? '' : NONE;
    fields[PLAYOFF_TYPE].style.display = isRRPlayoff ? '' : NONE;
    fields[PLAYOFF_DRAW_TYPE].style.display = isRRPlayoff ? '' : NONE;
    const playoffDrawType = inputs[PLAYOFF_DRAW_TYPE]?.value;
    fields[PLAYOFF_GROUP_SIZE].style.display = isRRPlayoff && playoffDrawType === ROUND_ROBIN ? '' : NONE;
    fields[GROUP_SIZE].style.display = [ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF].includes(drawType) ? '' : NONE;

    const isSwiss = drawType === SWISS;
    fields[ROUNDS_COUNT].style.display = isDrawMatic ? '' : NONE;
    fields[RATING_SCALE].style.display = isDrawMatic || isSwiss ? '' : NONE;
    fields[DYNAMIC_RATINGS].style.display = isDrawMatic ? '' : NONE;
    fields[TEAM_AVOIDANCE].style.display = isDrawMatic ? '' : NONE;

    if (isFIC) updateFicDepthOptions(inputs);
    fields[FIC_DEPTH].style.display = isFIC ? '' : NONE;

    fields[AUTOMATED].style.display = drawType === SWISS ? NONE : '';
    fields[SEEDING_POLICY].style.display = isAdHocType ? NONE : '';
    fields[QUALIFIERS_COUNT].style.display = isAdHocType ? NONE : '';
  };

  const drawTypeChange = ({ e, fields, inputs }: FormInteractionParams) => {
    const drawType = (e!.target as HTMLSelectElement).value;

    if (!maxQualifiers) updateDrawSize({ drawId, drawType, fields, inputs });
    checkCreationMethod({ fields, inputs });

    if (fields) {
      updateFieldVisibility(fields, drawType, inputs);
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

  const playoffDrawTypeChange = ({ e, fields, inputs }: FormInteractionParams) => {
    const playoffDrawType = (e!.target as HTMLSelectElement).value;
    if (fields) {
      fields[PLAYOFF_GROUP_SIZE].style.display = playoffDrawType === ROUND_ROBIN ? '' : NONE;

      // PAGE_PLAYOFF requires exactly 4 finishers — force TOP_FINISHERS with advance=2
      if (playoffDrawType === PAGE_PLAYOFF && inputs) {
        inputs[PLAYOFF_TYPE].value = TOP_FINISHERS;
        inputs[ADVANCE_PER_GROUP].value = '2';
        fields[ADVANCE_PER_GROUP].style.display = '';
        fields[GROUP_REMAINING].style.display = '';
        fields[TOTAL_ADVANCE].style.display = NONE;
      }
    }
  };

  const playoffTypeChange = ({ e, fields, inputs }: FormInteractionParams) => {
    const playoffType = (e!.target as HTMLSelectElement).value;
    if (fields) {
      fields[ADVANCE_PER_GROUP].style.display = playoffType === TOP_FINISHERS ? '' : NONE;
      fields[TOTAL_ADVANCE].style.display = playoffType === BEST_FINISHERS ? '' : NONE;
      fields[GROUP_REMAINING].style.display =
        playoffType === TOP_FINISHERS || playoffType === BEST_FINISHERS ? '' : NONE;

      // PAGE_PLAYOFF requires TOP_FINISHERS; reset if user changes away
      if (playoffType !== TOP_FINISHERS && inputs?.[PLAYOFF_DRAW_TYPE]?.value === PAGE_PLAYOFF) {
        inputs[PLAYOFF_DRAW_TYPE].value = PLAY_OFF;
        fields[PLAYOFF_GROUP_SIZE].style.display = NONE;
      }
    }
  };

  const advancePerGroupChange = ({ e, fields, inputs }: FormInteractionParams) => {
    const advancePerGroup = Number.parseInt((e!.target as HTMLSelectElement).value);
    // PAGE_PLAYOFF requires exactly 2 per group; reset if user changes away
    if (advancePerGroup !== 2 && inputs?.[PLAYOFF_DRAW_TYPE]?.value === PAGE_PLAYOFF && fields) {
      inputs[PLAYOFF_DRAW_TYPE].value = PLAY_OFF;
      fields[PLAYOFF_GROUP_SIZE].style.display = NONE;
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
      onChange: playoffDrawTypeChange,
      control: PLAYOFF_DRAW_TYPE,
    },
    {
      onChange: advancePerGroupChange,
      control: ADVANCE_PER_GROUP,
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
