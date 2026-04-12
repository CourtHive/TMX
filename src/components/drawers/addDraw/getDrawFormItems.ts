/**
 * Draw form items configuration.
 * Generates form field definitions for draw creation with validation and options.
 */
import { acceptedEntriesCount } from './acceptedEntriesCount';
import { getDrawTypeOptions } from './getDrawTypeOptions';
import { drawFormModel } from './drawFormModel';
import { providerConfig } from 'config/providerConfig';
import { validators } from 'courthive-components';
import { t } from 'i18n';
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
  BEST_FINISHERS,
  CUSTOM,
  DRAFT,
  DRAW_NAME,
  DRAW_SIZE,
  DRAW_TYPE,
  DYNAMIC_RATINGS,
  FIC_DEPTH,
  GROUP_REMAINING,
  GROUP_SIZE,
  MANUAL,
  MATCHUP_FORMAT,
  PLAYOFF_DRAW_TYPE,
  PLAYOFF_GROUP_SIZE,
  PLAYOFF_TYPE,
  POSITIONS,
  QUALIFYING_FIRST,
  QUALIFYING_POSITIONS,
  QUALIFIERS_COUNT,
  RATING_SCALE,
  ROUNDS_COUNT,
  SEEDING_POLICY,
  STRUCTURE_NAME,
  TEAM_AVOIDANCE,
  TOP_FINISHERS,
  TOTAL_ADVANCE,
  WINNERS,
} from 'constants/tmxConstants';

const { ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF, SINGLE_ELIMINATION, QUALIFYING, MAIN } = drawDefinitionConstants;
const { DOMINANT_DUO, COLLEGE_DEFAULT, LAVER_CUP } = factoryConstants.tieFormatConstants;
const { POLICY_TYPE_SCORING, POLICY_TYPE_SEEDING } = policyConstants;
const { FLIGHT_PROFILE } = factoryConstants.extensionConstants;
const { SINGLES } = factoryConstants.eventConstants;
const { TEAM } = eventConstants;

// Seeding policy constants
const CLUSTER = 'CLUSTER';
const SEPARATE = 'SEPARATE';
const INHERIT = 'INHERIT';

interface DrawFormParams {
  event: any;
  drawId?: string;
  isQualifying?: boolean;
  isPopulateMain?: boolean;
  structureId?: string;
}

type QualifyingState = {
  qualifiersCount: number;
  structurePositionAssignments: any;
};

/**
 * Compute the suggested qualifier count for the draw form based on the
 * draw context (existing qualifying structure, attaching to a main draw,
 * populating from qualifying, etc.).
 *
 * Extracted from `getDrawFormItems` to keep that function under the
 * cognitive-complexity threshold; the inputs and the resolution rules
 * stay co-located here.
 */
function computeQualifyingState({
  event,
  drawId,
  structureId,
  isQualifying,
  isPopulateMain,
}: {
  event: any;
  drawId?: string;
  structureId?: string;
  isQualifying?: boolean;
  isPopulateMain?: boolean;
}): QualifyingState {
  const isAttachingQualifying = !!isQualifying && !!structureId;

  const positionAssignments =
    structureId && !isAttachingQualifying
      ? tournamentEngine.getPositionAssignments({ drawId, structureId })?.positionAssignments
      : undefined;

  const qualifierPositionCount = isAttachingQualifying
    ? (tournamentEngine
        .getPositionAssignments({ drawId, structureId })
        ?.positionAssignments?.filter((p: any) => p.qualifier).length ?? 0)
    : 0;

  const qualifyingEntriesExist = acceptedEntriesCount({ event, stage: QUALIFYING }) > 0;

  const drawDefinition = drawId && event.drawDefinitions?.find((def: any) => def.drawId === drawId);

  const mainStructure =
    isQualifying || isPopulateMain
      ? drawDefinition?.structures?.find((s: any) => s.stage === MAIN && s.stageSequence === 1)
      : undefined;
  const mainDrawSize = mainStructure?.positionAssignments?.length || 0;
  const mainEntryCount = isQualifying ? acceptedEntriesCount({ drawId, event, stage: MAIN }) : 0;

  // Derive qualifier count from the qualifying link. Placeholder links store the count
  // directly on `source.qualifyingPositions`; real links from generated qualifying structures
  // don't carry that field, so count the matchUps in the qualifying final round instead.
  const qualifyingLink =
    (isQualifying || isPopulateMain) && mainStructure
      ? drawDefinition?.links?.find((l: any) => l.target?.structureId === mainStructure.structureId)
      : undefined;
  const qualifyingSourceStructure = qualifyingLink
    ? drawDefinition?.structures?.find((s: any) => s.structureId === qualifyingLink.source?.structureId)
    : undefined;
  const qualifyingFinalRoundMatchUpsCount =
    qualifyingSourceStructure && qualifyingLink?.source?.roundNumber
      ? (qualifyingSourceStructure.matchUps?.filter((m: any) => m.roundNumber === qualifyingLink.source.roundNumber)
          .length ?? 0)
      : 0;
  const qualifyingSpotsFromLink = qualifyingLink?.source?.qualifyingPositions ?? qualifyingFinalRoundMatchUpsCount;
  const qualifyingSpotsFromMain = qualifyingEntriesExist
    ? qualifyingSpotsFromLink || Math.max(0, mainDrawSize - mainEntryCount)
    : 0;

  // For new MAIN draws: compute gap from the draw size we'll use
  const mainAcceptedCount = isQualifying ? 0 : acceptedEntriesCount({ drawId, event, stage: MAIN });
  const mainDrawSizeForGap = isQualifying ? 0 : tools.nextPowerOf2(mainAcceptedCount);
  const qualifyingSpotsFromEntries = qualifyingEntriesExist ? Math.max(0, mainDrawSizeForGap - mainAcceptedCount) : 0;

  const qualifiersCount = resolveQualifiersCount({
    isAttachingQualifying,
    isQualifying,
    isPopulateMain,
    structureId,
    qualifierPositionCount,
    qualifyingSpotsFromMain,
    qualifyingSpotsFromLink,
    qualifyingSpotsFromEntries,
  });

  return { qualifiersCount, structurePositionAssignments: positionAssignments };
}

function resolveQualifiersCount({
  isAttachingQualifying,
  isQualifying,
  isPopulateMain,
  structureId,
  qualifierPositionCount,
  qualifyingSpotsFromMain,
  qualifyingSpotsFromLink,
  qualifyingSpotsFromEntries,
}: {
  isAttachingQualifying: boolean;
  isQualifying?: boolean;
  isPopulateMain?: boolean;
  structureId?: string;
  qualifierPositionCount: number;
  qualifyingSpotsFromMain: number;
  qualifyingSpotsFromLink: number;
  qualifyingSpotsFromEntries: number;
}): number {
  if (isAttachingQualifying) return qualifierPositionCount || qualifyingSpotsFromMain || 1;
  if (isQualifying) return qualifyingSpotsFromMain;
  if (isPopulateMain) return qualifyingSpotsFromLink;
  if (structureId) return 1;
  return qualifyingSpotsFromEntries;
}

export function getDrawFormItems({ event, drawId, isQualifying, isPopulateMain, structureId }: DrawFormParams): {
  structurePositionAssignments: any;
  items: any[];
} {
  const stage = isQualifying ? QUALIFYING : MAIN;
  const drawsCount = event.drawDefinitions?.length || 0; // need to take into consideration flightProfile.flights
  const drawType = SINGLE_ELIMINATION;
  const isAttachingQualifying = !!isQualifying && !!structureId;

  // Phase B (Mode 1 of 6): NEW_MAIN routes through the state-engine model.
  // Other modes still use the legacy in-place computation until they are
  // migrated in turn. See `Mentat/statuses/2026-04-11-tmx-session-handoff.md`
  // for the migration order.
  const isNewMain = !isQualifying && !isPopulateMain && !structureId;
  const newMainView = isNewMain ? drawFormModel({ kind: 'NEW_MAIN', event }, {}) : undefined;

  const { qualifiersCount, structurePositionAssignments } = isNewMain
    ? { qualifiersCount: newMainView!.derivedValues.qualifiersCount, structurePositionAssignments: undefined }
    : computeQualifyingState({
        event,
        drawId,
        structureId,
        isQualifying,
        isPopulateMain,
      });

  const structureName = 'Qualifying';

  const qualifyingEntriesCount = isQualifying ? acceptedEntriesCount({ event, stage }) : 0;
  const drawSize = isNewMain
    ? newMainView!.derivedValues.drawSize
    : structurePositionAssignments?.length ||
      (isQualifying && qualifyingEntriesCount
        ? qualifyingEntriesCount
        : tools.nextPowerOf2(acceptedEntriesCount({ drawId, event, stage })));
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
      label: t('drawers.addDraw.custom'),
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
    { label: t('drawers.addDraw.dominantDuo'), value: DOMINANT_DUO, selected: true },
    { label: t('drawers.addDraw.collegeDefault'), value: COLLEGE_DEFAULT },
    { label: t('drawers.addDraw.laverCup'), value: LAVER_CUP },
    { label: t('drawers.addDraw.custom'), value: CUSTOM },
  ];

  const seedingPolicyOptions = [
    ...(hasExistingPolicy ? [{ label: t('drawers.addDraw.inherited'), value: INHERIT, selected: true }] : []),
    { label: t('drawers.addDraw.separatedUsta'), value: SEPARATE, selected: !hasExistingPolicy },
    { label: t('drawers.addDraw.adjacentItf'), value: CLUSTER },
  ];

  const { validGroupSizes } = tournamentEngine.getValidGroupSizes({ drawSize: 32, groupSizeLimit: 8 });
  const roundRobinOptions = validGroupSizes.map((size: number) => ({ label: size, value: size }));
  const playoffOptions = [
    { label: t('drawers.addDraw.groupWinners'), value: WINNERS },
    { label: t('drawers.addDraw.groupPositions'), value: POSITIONS },
    { label: t('drawers.addDraw.topFinishers'), value: TOP_FINISHERS },
    { label: t('drawers.addDraw.bestFinishers'), value: BEST_FINISHERS },
  ];
  const advanceOptions = [
    { label: '2', value: 2 },
    { label: '3', value: 3 },
    { label: '4', value: 4 },
  ];

  const disableAutomated = !!structureId && !isAttachingQualifying;
  const allCreationOptions = [
    { label: AUTOMATED, value: AUTOMATED, selected: !disableAutomated, disabled: disableAutomated },
    { label: DRAFT, value: DRAFT, disabled: disableAutomated },
    { label: MANUAL, value: false, selected: disableAutomated },
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
    for (const item of p.ratings?.[SINGLES] || []) {
      presentRatings.add(item.scaleName);
    }
  }
  const activeRatingKeys = Object.keys(ratingsParameters).filter(
    (key) => !(ratingsParameters as any)[key].deprecated && presentRatings.has(key),
  );
  const ratingScaleOptions = [
    { label: t('drawers.addDraw.offOption'), value: '', selected: true },
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
      error: t('drawers.addDraw.minCharsError'),
      placeholder: t('drawers.addDraw.structureNamePlaceholder'),
      validator: validators.nameValidator(4),
      label: t('drawers.addDraw.structureName'),
      value: structureName,
      field: STRUCTURE_NAME,
      selectOnFocus: true,
      visible: !!isQualifying,
    },
    {
      label: t('drawers.addDraw.qualifyingFirst'),
      field: QUALIFYING_FIRST,
      id: QUALIFYING_FIRST,
      checkbox: true,
      hide: !!isQualifying || !!isPopulateMain || !!drawId,
    },
    {
      error: t('drawers.addDraw.minCharsError'),
      placeholder: t('drawers.addDraw.drawNamePlaceholder'),
      value: flight?.drawName || `Draw ${drawsCount + 1}`,
      validator: validators.nameValidator(4),
      selectOnFocus: true,
      visible: !isQualifying && !isPopulateMain,
      label: t('drawers.addDraw.drawName'),
      field: DRAW_NAME,
      focus: true,
    },
    {
      options: getDrawTypeOptions({ isQualifying }),
      label: t('drawers.addDraw.drawType'),
      field: DRAW_TYPE,
      value: drawType,
    },
    {
      error: t('drawers.addDraw.drawSizeError', { max: maxDrawSize }),
      validator: validators.numericRange(2, maxDrawSize),
      selectOnFocus: true,
      label: t('drawers.addDraw.drawSize'),
      value: drawSize,
      field: DRAW_SIZE,
    },
    {
      visible: [ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF].includes(drawType),
      options: roundRobinOptions,
      label: t('drawers.addDraw.groupSize'),
      field: GROUP_SIZE,
      value: 4,
    },
    {
      visible: [ROUND_ROBIN_WITH_PLAYOFF].includes(drawType),
      options: playoffOptions,
      label: t('drawers.addDraw.playoffType'),
      field: PLAYOFF_TYPE,
    },
    {
      visible: [ROUND_ROBIN_WITH_PLAYOFF].includes(drawType),
      options: getDrawTypeOptions({ isPlayoff: true }),
      label: t('drawers.addDraw.playoffDrawType'),
      field: PLAYOFF_DRAW_TYPE,
    },
    {
      visible: false,
      options: roundRobinOptions,
      label: t('drawers.addDraw.playoffGroupSize'),
      field: PLAYOFF_GROUP_SIZE,
      value: 4,
    },
    {
      label: t('drawers.addDraw.advancePerGroup'),
      options: advanceOptions,
      field: ADVANCE_PER_GROUP,
      visible: false,
    },
    {
      label: t('drawers.addDraw.totalToAdvance'),
      field: TOTAL_ADVANCE,
      validator: validators.numericValidator,
      selectOnFocus: true,
      visible: false,
      value: 4,
    },
    {
      label: t('drawers.addDraw.secondPlayoffFromRemaining'),
      field: GROUP_REMAINING,
      id: GROUP_REMAINING,
      checkbox: true,
      visible: false,
    },
    {
      help: { text: t('drawers.addDraw.automationDisabled'), visible: false },
      options: creationOptions,
      label: t('drawers.addDraw.creation'),
      field: AUTOMATED,
      value: '',
    },
    {
      options: roundsCountOptions,
      label: t('drawers.addDraw.roundsCount'),
      field: ROUNDS_COUNT,
      value: 1,
      visible: false,
    },
    {
      options: ratingScaleOptions,
      label: t('drawers.addDraw.ratingScale'),
      field: RATING_SCALE,
      visible: false,
    },
    {
      label: t('drawers.addDraw.dynamicRatings'),
      field: DYNAMIC_RATINGS,
      id: DYNAMIC_RATINGS,
      checkbox: true,
      visible: false,
    },
    {
      label: t('drawers.addDraw.teamAvoidance'),
      field: TEAM_AVOIDANCE,
      id: TEAM_AVOIDANCE,
      checkbox: true,
      visible: false,
    },
    {
      options: [
        { label: 'Final', value: 'F', selected: true },
        { label: 'Semifinal', value: 'SF' },
        { label: 'Quarterfinal', value: 'QF' },
        { label: 'Round of 16', value: 'R16' },
      ],
      label: 'Consolation feed depth',
      field: FIC_DEPTH,
      visible: false,
    },
    {
      hide: event.eventType === TEAM,
      options: scoreFormatOptions,
      field: MATCHUP_FORMAT,
      label: t('drawers.addDraw.scoreFormat'),
      value: '',
    },
    {
      options: seedingPolicyOptions,
      field: SEEDING_POLICY,
      label: t('drawers.addDraw.seedingPolicy'),
      value: '',
    },
    {
      hide: event.eventType !== TEAM,
      options: tieFormatOptions,
      field: 'tieFormatName',
      label: t('drawers.addDraw.scorecard'),
      value: '',
    },
    {
      validator: validators.numericValidator,
      field: QUALIFIERS_COUNT,
      value: qualifiersCount,
      selectOnFocus: true,
      label: t('drawers.addDraw.qualifiers'),
    },
    {
      validator: validators.numericValidator,
      field: QUALIFYING_POSITIONS,
      value: 4,
      selectOnFocus: true,
      label: t('drawers.addDraw.qualifyingPositions'),
      visible: false,
    },
  ];

  return { items, structurePositionAssignments };
}
