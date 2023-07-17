import { numericValidator } from 'components/validators/numericValidator';
import { nameValidator } from 'components/validators/nameValidator';
import { numericRange } from 'components/validators/numericRange';
import { acceptedEntriesCount } from './acceptedEntriesCount';
import {
  drawEngine,
  factoryConstants,
  drawDefinitionConstants,
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

const { DOMINANT_DUO } = factoryConstants.tieFormatConstants;
const { POLICY_TYPE_SCORING } = policyConstants;
const { TEAM } = eventConstants;
const {
  AD_HOC,
  COMPASS,
  CURTIS,
  DOUBLE_ELIMINATION,
  /*
  // TODO: add configuration for FIC to achieve the following
  FEED_IN_CHAMPIONSHIP_TO_QF,
  FEED_IN_CHAMPIONSHIP_TO_R16,
  FEED_IN_CHAMPIONSHIP_TO_SF,
  MODIFIED_FEED_IN_CHAMPIONSHIP,
  */
  FEED_IN_CHAMPIONSHIP,
  FEED_IN,
  FIRST_MATCH_LOSER_CONSOLATION,
  FIRST_ROUND_LOSER_CONSOLATION,
  LUCKY_DRAW,
  OLYMPIC,
  PLAY_OFF,
  ROUND_ROBIN,
  ROUND_ROBIN_WITH_PLAYOFF,
  SINGLE_ELIMINATION,
  QUALIFYING,
  MAIN
} = drawDefinitionConstants;

const { ENTRY_PROFILE } = factoryConstants.extensionConstants;

export function getFormItems({ event, drawId, isQualifying }) {
  const stage = isQualifying ? QUALIFYING : MAIN;
  const drawsCount = event.drawDefinitions?.length || 0;
  let drawType = SINGLE_ELIMINATION;

  const drawSize = utilities.nextPowerOf2(acceptedEntriesCount(event, stage));

  const drawDefinition = drawId && event.drawDefinitions?.find((def) => def.drawId === drawId);
  const entryProfile = utilities.findExtension({ element: drawDefinition, name: ENTRY_PROFILE })?.extension?.value;
  const qualifiersCount = entryProfile?.[MAIN]?.qualifiersCount || 0;
  const structureName = 'Qualifying';

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

  return [
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
      field: DRAW_NAME
    },
    {
      value: drawType,
      label: 'Draw Type',
      field: 'drawType',
      options: [
        { label: 'Ad-hoc', value: AD_HOC },
        { label: 'Compass', value: COMPASS },
        { label: 'Curtis consolation', value: CURTIS },
        { label: 'Double elimination', value: DOUBLE_ELIMINATION },
        { label: 'Elimination: fed consolation', value: FEED_IN_CHAMPIONSHIP },
        { label: 'First match loser consolation', value: FIRST_MATCH_LOSER_CONSOLATION },
        { label: 'First round loser consolation', value: FIRST_ROUND_LOSER_CONSOLATION },
        { label: 'Lucky', value: LUCKY_DRAW },
        { label: 'Olympic', value: OLYMPIC },
        { label: 'Playoff', value: PLAY_OFF },
        { label: 'Round robin w/ playoff', value: ROUND_ROBIN_WITH_PLAYOFF },
        { label: 'Round robin', value: ROUND_ROBIN },
        { label: 'Single elimination', value: SINGLE_ELIMINATION },
        { label: 'Staggered Entry', value: FEED_IN }
      ]
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
      label: 'Creation',
      field: AUTOMATED,
      value: '',
      options: [
        { label: AUTOMATED, value: AUTOMATED, selected: true },
        { label: MANUAL, value: false }
      ]
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
      disabled: isQualifying,
      field: QUALIFIERS_COUNT,
      value: qualifiersCount,
      selectOnFocus: true,
      label: 'Qualifiers'
    }
  ];
}
