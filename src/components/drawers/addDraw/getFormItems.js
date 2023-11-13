import { numericValidator } from 'components/validators/numericValidator';
import { nameValidator } from 'components/validators/nameValidator';
import { numericRange } from 'components/validators/numericRange';
import { acceptedEntriesCount } from './acceptedEntriesCount';
import { getDrawTypeOptions } from './getDrawTypeOptions';
import {
  drawEngine,
  factoryConstants,
  drawDefinitionConstants,
  tournamentEngine,
  eventConstants,
  policyConstants,
  utilities
} from 'tods-competition-factory';

import POLICY_SCORING from 'assets/policies/scoringPolicy';
import {
  ADVANCE_PER_GROUP,
  AUTOMATED,
  CUSTOM,
  DRAW_NAME,
  DRAW_SIZE,
  DRAW_TYPE,
  GROUP_REMAINING,
  GROUP_SIZE,
  MANUAL,
  MATCHUP_FORMAT,
  PLAYOFF_TYPE,
  POSITIONS,
  QUALIFIERS_COUNT,
  STRUCTURE_NAME,
  TOP_FINISHERS,
  WINNERS
} from 'constants/tmxConstants';

const { ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF, SINGLE_ELIMINATION, QUALIFYING, MAIN } = drawDefinitionConstants;
const { DOMINANT_DUO, TIME_TENNIS_DUAL, TIME_TENNIS_PRO_CIRCUIT } = factoryConstants.tieFormatConstants;
const { POLICY_TYPE_SCORING } = policyConstants;
const { TEAM } = eventConstants;

const { ENTRY_PROFILE } = factoryConstants.extensionConstants;

export function getFormItems({ event, drawId, isQualifying, structureId }) {
  const stage = isQualifying ? QUALIFYING : MAIN;
  const drawsCount = event.drawDefinitions?.length || 0;
  let drawType = SINGLE_ELIMINATION;

  const drawDefinition = drawId && event.drawDefinitions?.find((def) => def.drawId === drawId);
  const structurePositionAssignments =
    structureId && tournamentEngine.getPositionAssignments({ drawId, structureId })?.positionAssignments;
  // const structure = structureId && drawDefinition?.structures.find((s) => s.structureId === structureId);
  // const isMain = structure?.stage === MAIN && structure?.stageSequence === 1;
  const entryProfile = utilities.findExtension({ element: drawDefinition, name: ENTRY_PROFILE })?.extension?.value;
  const initialQualifiersCount = structureId ? 1 : 0;
  const qualifiersCount = (!structureId && entryProfile?.[MAIN]?.qualifiersCount) || initialQualifiersCount;
  const structureName = 'Qualifying';

  const drawSize = structurePositionAssignments?.length || utilities.nextPowerOf2(acceptedEntriesCount(event, stage));

  const scoreFormatOptions = [
    {
      label: 'Custom',
      value: CUSTOM
    }
  ].concat(
    POLICY_SCORING[POLICY_TYPE_SCORING].matchUpFormats.map(({ matchUpFormat, description: label }) => ({
      selected: matchUpFormat === 'SET3-S:6/TB7',
      value: matchUpFormat,
      label
    }))
  );

  const tieFormatOptions = [
    { label: 'Time Tennis Pro Circuit', value: TIME_TENNIS_PRO_CIRCUIT },
    { label: 'Time Tennis', value: TIME_TENNIS_DUAL },
    { label: 'Dominant Duo', value: DOMINANT_DUO, selected: true },
    { label: 'Custom', value: CUSTOM }
  ];

  const { validGroupSizes } = drawEngine.getValidGroupSizes({ drawSize: 32, groupSizeLimit: 8 });
  const roundRobinOptions = validGroupSizes.map((size) => ({ label: size, value: size }));
  const playoffOptions = [
    { label: 'Group winners', value: WINNERS },
    { label: 'Group positions', value: POSITIONS },
    { label: 'Top finishers', value: TOP_FINISHERS }
  ];
  const advanceOptions = [
    { label: '2', value: 2 },
    { label: '3', value: 3 },
    { label: '4', value: 4 }
  ];

  console.log({ structureId, disabled: !!structureId });
  const creationOptions = [
    { label: AUTOMATED, value: AUTOMATED, selected: !structureId, disabled: !!structureId },
    { label: MANUAL, value: false, selected: structureId }
  ];

  const items = [
    {
      error: 'minimum of 4 characters',
      placeholder: 'Display name of the structure',
      validator: nameValidator(4),
      label: 'Structure name',
      value: structureName,
      field: STRUCTURE_NAME,
      selectOnFocus: true,
      hide: !isQualifying
    },
    {
      error: 'minimum of 4 characters',
      placeholder: 'Display name of the draw',
      value: `Draw ${drawsCount + 1}`,
      validator: nameValidator(4),
      selectOnFocus: true,
      hide: isQualifying,
      label: 'Draw name',
      field: DRAW_NAME,
      focus: true
    },
    {
      options: getDrawTypeOptions({ isQualifying }),
      label: 'Draw Type',
      field: DRAW_TYPE,
      value: drawType
    },
    {
      error: 'Must be in range 2-128',
      validator: numericRange(2, 128),
      selectOnFocus: true,
      label: 'Draw size',
      value: drawSize,
      field: DRAW_SIZE
    },
    {
      visible: [ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF].includes(drawType),
      options: roundRobinOptions,
      label: 'Group size',
      field: GROUP_SIZE,
      value: 4
    },
    {
      visible: [ROUND_ROBIN_WITH_PLAYOFF].includes(drawType),
      options: playoffOptions,
      label: 'Playoff Type',
      field: PLAYOFF_TYPE
    },
    {
      label: 'Advance per group',
      options: advanceOptions,
      field: ADVANCE_PER_GROUP,
      visible: false
    },
    {
      label: '2nd playoff from remaining',
      field: GROUP_REMAINING,
      checkbox: true,
      visible: false
    },
    {
      help: { text: 'Automation disabled', visible: false },
      options: creationOptions,
      label: 'Creation',
      field: AUTOMATED,
      value: ''
    },
    {
      hide: event.eventType === TEAM,
      options: scoreFormatOptions,
      field: MATCHUP_FORMAT,
      label: 'Score format',
      value: ''
    },
    {
      hide: event.eventType !== TEAM,
      options: tieFormatOptions,
      field: 'tieFormatName',
      label: 'Scorecard',
      value: ''
    },
    {
      validator: numericValidator,
      disabled: isQualifying && !structureId,
      field: QUALIFIERS_COUNT,
      value: qualifiersCount,
      selectOnFocus: true,
      label: 'Qualifiers'
    }
  ];

  return { items, structurePositionAssignments };
}
