import {
  drawEngine,
  factoryConstants,
  drawDefinitionConstants,
  eventConstants,
  policyConstants
} from 'tods-competition-factory';
import { numericValidator } from 'components/validators/numericValidator';
import { nameValidator } from 'components/validators/nameValidator';

import POLICY_SCORING from 'assets/policies/scoringPolicy';
import {
  ADVANCE_PER_GROUP,
  AUTOMATED,
  CUSTOM,
  GROUP_REMAINING,
  MANUAL,
  POSITIONS,
  TOP_FINISHERS,
  WINNERS,
  acceptedEntryStatuses
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
  // TODO: add configueration for FIC to achieve the following
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
  MAIN,
  ROUND_ROBIN,
  ROUND_ROBIN_WITH_PLAYOFF,
  SINGLE_ELIMINATION
} = drawDefinitionConstants;

function acceptedEntriesCount(event) {
  return event.entries.filter(({ entryStage = MAIN, entryStatus }) =>
    acceptedEntryStatuses.includes(`${entryStage}.${entryStatus}`)
  ).length;
}

export function getFormItems({ event }) {
  const drawsCount = event.drawDefinitions?.length || 0;
  let drawType = SINGLE_ELIMINATION;

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
      placeholder: 'Display name of the draw',
      value: `Draw ${drawsCount + 1}`,
      label: 'Draw name',
      field: 'drawName',
      error: 'Please enter a name of at least 5 characters',
      validator: nameValidator(5)
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
      value: acceptedEntriesCount(event),
      validator: numericValidator,
      label: 'Draw size',
      field: 'drawSize'
    },
    {
      visible: [ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF].includes(drawType),
      options: roundRobinOptions,
      label: 'Group size',
      field: 'groupSize',
      value: 4
    },
    {
      visible: [ROUND_ROBIN_WITH_PLAYOFF].includes(drawType),
      options: playoffOptions,
      label: 'Playoff Type',
      field: 'playoffType'
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
      value: '',
      label: 'Creation',
      field: 'automated',
      options: [
        { label: AUTOMATED, value: AUTOMATED, selected: true },
        { label: MANUAL, value: false }
      ]
    },
    {
      hide: event.eventType === TEAM,
      options: scoreFormatOptions,
      field: 'matchUpFormat',
      label: 'Score format',
      value: ''
    },
    {
      hide: event.eventType !== TEAM,
      options: tieFormatOptions,
      field: 'tieFormatName',
      label: 'Scorecard',
      value: ''
    }
  ];
}
