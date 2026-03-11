/**
 * Draw form items configuration.
 * Generates form field definitions for draw creation with validation and options.
 */
import { acceptedEntriesCount } from './acceptedEntriesCount';
import { getDrawTypeOptions } from './getDrawTypeOptions';
import { providerConfig } from 'config/providerConfig';
import { validators } from 'courthive-components';
import {
  factoryConstants,
  drawDefinitionConstants,
  tournamentEngine,
  eventConstants,
  policyConstants,
  fixtures,
  tools,
} from 'tods-competition-factory';

import POLICY_SCORING from 'assets/policies/scoringPolicy';
import {
  ADVANCE_PER_GROUP,
  AUTOMATED,
  CUSTOM,
  DRAFT,
  DRAW_NAME,
  DRAW_SIZE,
  DRAW_TYPE,
  DYNAMIC_RATINGS,
  GROUP_REMAINING,
  GROUP_SIZE,
  MANUAL,
  MATCHUP_FORMAT,
  PLAYOFF_TYPE,
  POSITIONS,
  QUALIFIERS_COUNT,
  RATING_SCALE,
  ROUNDS_COUNT,
  SEEDING_POLICY,
  STRUCTURE_NAME,
  TEAM_AVOIDANCE,
  TOP_FINISHERS,
  WINNERS,
} from 'constants/tmxConstants';

const { ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF, SINGLE_ELIMINATION, QUALIFYING, MAIN } = drawDefinitionConstants;
const { DOMINANT_DUO, COLLEGE_DEFAULT, LAVER_CUP } = factoryConstants.tieFormatConstants;
const { POLICY_TYPE_SCORING, POLICY_TYPE_SEEDING } = policyConstants;
const { FLIGHT_PROFILE } = factoryConstants.extensionConstants;
const { SINGLES } = factoryConstants.eventConstants;
const { TEAM } = eventConstants;

const { ENTRY_PROFILE } = factoryConstants.extensionConstants;

// Seeding policy constants
const CLUSTER = 'CLUSTER';
const SEPARATE = 'SEPARATE';
const INHERIT = 'INHERIT';

interface DrawFormParams {
  event: any;
  drawId?: string;
  isQualifying?: boolean;
  structureId?: string;
}

export function getDrawFormItems({ event, drawId, isQualifying, structureId }: DrawFormParams): {
  structurePositionAssignments: any;
  items: any[];
} {
  const stage = isQualifying ? QUALIFYING : MAIN;
  const drawsCount = event.drawDefinitions?.length || 0; // need to take into consideration flightProfile.flights
  const drawType = SINGLE_ELIMINATION;

  const drawDefinition = drawId && event.drawDefinitions?.find((def: any) => def.drawId === drawId);
  const structurePositionAssignments =
    structureId && tournamentEngine.getPositionAssignments({ drawId, structureId })?.positionAssignments;
  const entryProfile = tournamentEngine.findExtension({ element: drawDefinition, name: ENTRY_PROFILE })?.extension
    ?.value;
  const initialQualifiersCount = structureId ? 1 : 0;
  const qualifiersCount = (!structureId && entryProfile?.[MAIN]?.qualifiersCount) || initialQualifiersCount;
  const structureName = 'Qualifying';

  const drawSize =
    structurePositionAssignments?.length || tools.nextPowerOf2(acceptedEntriesCount({ drawId, event, stage }));
  const maxDrawSize = Math.max(drawSize, 512); // Allow at least 512, or the next power of 2 above entries

  // Check for existing seeding policy at event or tournament level
  const tournamentRecord = tournamentEngine.getTournamentInfo()?.tournamentRecord;
  const existingEventPolicy = event?.policyDefinitions?.[POLICY_TYPE_SEEDING];
  const existingTournamentPolicy = tournamentRecord?.policyDefinitions?.[POLICY_TYPE_SEEDING];
  const hasExistingPolicy = existingEventPolicy || existingTournamentPolicy;

  const flightProfile = event?.extensions?.find((ext: any) => ext.name === FLIGHT_PROFILE)?.value;
  const flight = flightProfile?.flights?.find((f: any) => f.drawId === drawId);

  const allowedFormats = providerConfig.getAllowedList('allowedMatchUpFormats');
  const scoreFormatOptions = [
    {
      label: 'Custom',
      value: CUSTOM,
    },
  ].concat(
    POLICY_SCORING[POLICY_TYPE_SCORING].matchUpFormats
      .filter(({ matchUpFormat }: any) => !allowedFormats.length || allowedFormats.includes(matchUpFormat))
      .map(({ matchUpFormat, description: label }: any) => ({
        selected: matchUpFormat === 'SET3-S:6/TB7',
        value: matchUpFormat,
        label,
      })),
  );

  const tieFormatOptions = [
    { label: 'Dominant Duo', value: DOMINANT_DUO, selected: true },
    { label: 'College Default', value: COLLEGE_DEFAULT },
    { label: 'Laver Cup', value: LAVER_CUP },
    { label: 'Custom', value: CUSTOM },
  ];

  const seedingPolicyOptions = [
    ...(hasExistingPolicy ? [{ label: 'Inherited', value: INHERIT, selected: true }] : []),
    { label: 'Separated (USTA)', value: SEPARATE, selected: !hasExistingPolicy },
    { label: 'Adjacent (ITF)', value: CLUSTER },
  ];

  const { validGroupSizes } = tournamentEngine.getValidGroupSizes({ drawSize: 32, groupSizeLimit: 8 });
  const roundRobinOptions = validGroupSizes.map((size: number) => ({ label: size, value: size }));
  const playoffOptions = [
    { label: 'Group winners', value: WINNERS },
    { label: 'Group positions', value: POSITIONS },
    { label: 'Top finishers', value: TOP_FINISHERS },
  ];
  const advanceOptions = [
    { label: '2', value: 2 },
    { label: '3', value: 3 },
    { label: '4', value: 4 },
  ];

  const allCreationOptions = [
    { label: AUTOMATED, value: AUTOMATED, selected: !structureId, disabled: !!structureId },
    { label: DRAFT, value: DRAFT, disabled: !!structureId },
    { label: MANUAL, value: false, selected: structureId },
  ];

  // Filter creation methods by provider config
  const allowedMethods = providerConfig.getAllowedList('allowedCreationMethods');
  const creationOptions = allowedMethods.length
    ? allCreationOptions.filter((opt) => {
        const val = opt.value === false ? MANUAL : String(opt.value);
        return allowedMethods.includes(val);
      })
    : allCreationOptions.filter((opt) => {
        // Also respect individual permission flags
        if (opt.value === DRAFT && !providerConfig.isAllowed('canUseDraftPositioning')) return false;
        if (opt.value === false && !providerConfig.isAllowed('canUseManualPositioning')) return false;
        return true;
      });

  // Discover available rating scales for DrawMatic configuration
  const { ratingsParameters } = fixtures;
  const { participants: allParticipants = [] } = tournamentEngine.getParticipants({ withScaleValues: true }) ?? {};
  const presentRatings = new Set<string>();
  for (const p of allParticipants) {
    for (const item of (p as any).ratings?.[SINGLES] || []) {
      presentRatings.add(item.scaleName);
    }
  }
  const activeRatingKeys = Object.keys(ratingsParameters).filter(
    (key) => !(ratingsParameters as any)[key].deprecated && presentRatings.has(key),
  );
  const ratingScaleOptions = [
    { label: '--Off--', value: '', selected: true },
    ...activeRatingKeys.map((key) => ({ label: key, value: key.toLowerCase() })),
  ];

  const roundsCountOptions = [
    { label: '1', value: 1, selected: true },
    { label: '2', value: 2 },
    { label: '3', value: 3 },
    { label: '4', value: 4 },
    { label: '5', value: 5 },
    { label: '6', value: 6 },
    { label: '7', value: 7 },
    { label: '8', value: 8 },
  ];

  const items = [
    {
      error: 'minimum of 4 characters',
      placeholder: 'Display name of the structure',
      validator: validators.nameValidator(4),
      label: 'Structure name',
      value: structureName,
      field: STRUCTURE_NAME,
      selectOnFocus: true,
      hide: !isQualifying,
    },
    {
      error: 'minimum of 4 characters',
      placeholder: 'Display name of the draw',
      value: flight?.drawName || `Draw ${drawsCount + 1}`,
      validator: validators.nameValidator(4),
      selectOnFocus: true,
      hide: isQualifying,
      label: 'Draw name',
      field: DRAW_NAME,
      focus: true,
    },
    {
      options: getDrawTypeOptions({ isQualifying }),
      label: 'Draw Type',
      field: DRAW_TYPE,
      value: drawType,
    },
    {
      error: `Must be in range 2-${maxDrawSize}`,
      validator: validators.numericRange(2, maxDrawSize),
      selectOnFocus: true,
      label: 'Draw size',
      value: drawSize,
      field: DRAW_SIZE,
    },
    {
      visible: [ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF].includes(drawType),
      options: roundRobinOptions,
      label: 'Group size',
      field: GROUP_SIZE,
      value: 4,
    },
    {
      visible: [ROUND_ROBIN_WITH_PLAYOFF].includes(drawType),
      options: playoffOptions,
      label: 'Playoff Type',
      field: PLAYOFF_TYPE,
    },
    {
      label: 'Advance per group',
      options: advanceOptions,
      field: ADVANCE_PER_GROUP,
      visible: false,
    },
    {
      label: '2nd playoff from remaining',
      field: GROUP_REMAINING,
      id: GROUP_REMAINING,
      checkbox: true,
      visible: false,
    },
    {
      help: { text: 'Automation disabled', visible: false },
      options: creationOptions,
      label: 'Creation',
      field: AUTOMATED,
      value: '',
    },
    {
      options: roundsCountOptions,
      label: 'Rounds to generate',
      field: ROUNDS_COUNT,
      value: 1,
      visible: false,
    },
    {
      options: ratingScaleOptions,
      label: 'Rating scale',
      field: RATING_SCALE,
      visible: false,
    },
    {
      label: 'Dynamic ratings',
      field: DYNAMIC_RATINGS,
      checkbox: true,
      visible: false,
    },
    {
      label: 'Team avoidance',
      field: TEAM_AVOIDANCE,
      checkbox: true,
      visible: false,
    },
    {
      hide: event.eventType === TEAM,
      options: scoreFormatOptions,
      field: MATCHUP_FORMAT,
      label: 'Score format',
      value: '',
    },
    {
      options: seedingPolicyOptions,
      field: SEEDING_POLICY,
      label: 'Seeding policy',
      value: '',
    },
    {
      hide: event.eventType !== TEAM,
      options: tieFormatOptions,
      field: 'tieFormatName',
      label: 'Scorecard',
      value: '',
    },
    {
      disabled: isQualifying && !structureId,
      validator: validators.numericValidator,
      field: QUALIFIERS_COUNT,
      value: qualifiersCount,
      selectOnFocus: true,
      label: 'Qualifiers',
    },
  ];

  return { items, structurePositionAssignments };
}
