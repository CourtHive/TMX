/**
 * Submit draw parameters and generate draw structure.
 * Handles draw creation, qualifying structures, and tie format configuration.
 */
import { editTieFormat } from 'components/overlays/editTieFormat.js/editTieFormat';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { validators } from 'courthive-components';
import { generateDraw } from './generateDraw';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';
import {
  drawDefinitionConstants,
  entryStatusConstants,
  factoryConstants,
  tournamentEngine,
  tools,
  policyConstants,
} from 'tods-competition-factory';

// constants
import { ADD_DRAW_ENTRIES, ATTACH_QUALIFYING_STRUCTURE, SET_POSITION_ASSIGNMENTS } from 'constants/mutationConstants';
import POLICY_SEEDING from 'assets/policies/seedingPolicy';
import {
  AUTOMATED,
  BEST_FINISHERS,
  CUSTOM,
  DRAFT,
  DRAW_MATIC,
  DRAW_NAME,
  DRAW_SIZE,
  DRAW_TYPE,
  DYNAMIC_RATINGS,
  FIC_DEPTH,
  GROUP_REMAINING,
  GROUP_SIZE,
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
} from 'constants/tmxConstants';

const {
  AD_HOC,
  ADAPTIVE,
  FEED_IN,
  LUCKY_DRAW,
  MAIN,
  PAGE_PLAYOFF,
  QUALIFYING,
  FEED_IN_CHAMPIONSHIP,
  FEED_IN_CHAMPIONSHIP_TO_QF,
  FEED_IN_CHAMPIONSHIP_TO_R16,
  FEED_IN_CHAMPIONSHIP_TO_SF,
  ROUND_ROBIN,
  ROUND_ROBIN_WITH_PLAYOFF,
  SEPARATE,
  SWISS,
  CLUSTER,
} = drawDefinitionConstants;
const { DIRECT_ENTRY_STATUSES } = entryStatusConstants;
const { POLICY_TYPE_SEEDING } = policyConstants;

// Seeding policy constants
const INHERIT = 'INHERIT';

// Seeding policy definitions matching factory defaults
const POLICY_SEEDING_DEFAULT = {
  [POLICY_TYPE_SEEDING]: {
    validSeedPositions: { ignore: true },
    duplicateSeedNumbers: true,
    drawSizeProgression: true,
    seedingProfile: {
      drawTypes: {
        [ROUND_ROBIN_WITH_PLAYOFF]: { positioning: factoryConstants.drawDefinitionConstants.WATERFALL },
        [ROUND_ROBIN]: { positioning: factoryConstants.drawDefinitionConstants.WATERFALL },
      },
      positioning: SEPARATE,
    },
    policyName: 'USTA SEEDING',
    seedsCountThresholds: [
      { drawSize: 4, minimumParticipantCount: 3, seedsCount: 2 },
      { drawSize: 16, minimumParticipantCount: 12, seedsCount: 4 },
      { drawSize: 32, minimumParticipantCount: 24, seedsCount: 8 },
      { drawSize: 64, minimumParticipantCount: 48, seedsCount: 16 },
      { drawSize: 128, minimumParticipantCount: 96, seedsCount: 32 },
      { drawSize: 256, minimumParticipantCount: 192, seedsCount: 64 },
    ],
  },
};

const POLICY_SEEDING_ITF = {
  [POLICY_TYPE_SEEDING]: {
    seedingProfile: { positioning: CLUSTER },
    validSeedPositions: { ignore: true },
    duplicateSeedNumbers: true,
    drawSizeProgression: true,
    policyName: 'ITF SEEDING',
    seedsCountThresholds: [
      { drawSize: 4, minimumParticipantCount: 3, seedsCount: 2 },
      { drawSize: 16, minimumParticipantCount: 12, seedsCount: 4 },
      { drawSize: 32, minimumParticipantCount: 24, seedsCount: 8 },
      { drawSize: 64, minimumParticipantCount: 48, seedsCount: 16 },
      { drawSize: 128, minimumParticipantCount: 97, seedsCount: 32 },
      { drawSize: 256, minimumParticipantCount: 192, seedsCount: 64 },
    ],
  },
};

function getPlayoffGroups(
  playoffType: string,
  advancePerGroup: number,
  groupRemaining: boolean,
  groupSize: number,
  inputs?: any,
): any[] {
  const playoffGroups: any[] = [];

  // Get the selected playoff draw type and optional playoff group size
  const playoffDrawType = inputs?.[PLAYOFF_DRAW_TYPE]?.value;
  const playoffGroupSize = inputs?.[PLAYOFF_GROUP_SIZE]?.value
    ? Number.parseInt(inputs[PLAYOFF_GROUP_SIZE].value)
    : undefined;

  // Build extra properties to spread into each playoff group
  const playoffDrawProps: any = {};
  if (playoffDrawType) {
    playoffDrawProps.drawType = playoffDrawType;
  }
  if (playoffDrawType === ROUND_ROBIN && playoffGroupSize) {
    playoffDrawProps.structureOptions = { groupSize: playoffGroupSize };
  }

  if (playoffType === TOP_FINISHERS) {
    const groups = [tools.generateRange(1, advancePerGroup + 1)];
    if (groupRemaining) {
      const group = tools.generateRange(advancePerGroup + 1, groupSize + 1);
      if (group.length) groups.push(group);
    }
    groups.forEach((finishingPositions, i) => {
      playoffGroups.push({
        structureName: `Playoff ${i + 1}`,
        finishingPositions,
        ...playoffDrawProps,
      });
    });
  } else if (playoffType === BEST_FINISHERS) {
    const totalAdvance = Number.parseInt(inputs[TOTAL_ADVANCE]?.value || 0);
    if (totalAdvance > 0) {
      playoffGroups.push({
        finishingPositions: [1],
        bestOf: totalAdvance,
        rankBy: 'GEMscore',
        structureName: 'Playoff 1',
        ...playoffDrawProps,
      });
      if (groupRemaining) {
        playoffGroups.push({
          remainder: true,
          structureName: 'Playoff 2',
          ...playoffDrawProps,
        });
      }
    }
  } else if (playoffType === POSITIONS) {
    tools.generateRange(1, groupSize + 1).forEach((c) => {
      playoffGroups.push({
        structureName: `Playoff ${c}`,
        finishingPositions: [c],
        ...playoffDrawProps,
      });
    });
  }

  return playoffGroups;
}

function validatePagePlayoff(structureOptions: any, inputs: any, groupSize: number): boolean | undefined {
  const pagePlayoffGroup = structureOptions?.playoffGroups?.find((pg: any) => pg.drawType === PAGE_PLAYOFF);
  if (!pagePlayoffGroup) return undefined;

  const drawSizeValue = Number.parseInt(inputs[DRAW_SIZE]?.value || '0');
  const groupCount = Math.floor(drawSizeValue / groupSize);
  const finishingPositions = pagePlayoffGroup.finishingPositions || [];
  const expectedCount = pagePlayoffGroup.bestOf || groupCount * finishingPositions.length;

  if (expectedCount !== 4) {
    tmxToast({
      message: `Page Playoff requires exactly 4 finishers (current configuration produces ${expectedCount})`,
      intent: 'is-warning',
      pauseOnHover: true,
    });
    return false;
  }
  return true;
}

function getStructureOptions(drawType: string, inputs: any): any {
  const groupSize = Number.parseInt(inputs[GROUP_SIZE].value);

  if (drawType === ROUND_ROBIN_WITH_PLAYOFF) {
    const advancePerGroup = Number.parseInt(inputs.advancePerGroup?.value || 0);
    const groupRemaining = inputs[GROUP_REMAINING]?.checked;
    const playoffType = inputs[PLAYOFF_TYPE]?.value;
    const playoffGroups = getPlayoffGroups(playoffType, advancePerGroup, groupRemaining, groupSize, inputs);

    const structureOptions: any = { groupSize };
    if (playoffGroups.length) {
      structureOptions.playoffGroups = playoffGroups;
    } else {
      // WINNERS case: group winners advance; pass drawType if non-default
      const playoffDrawType = inputs?.[PLAYOFF_DRAW_TYPE]?.value;
      const playoffGroupSize = inputs?.[PLAYOFF_GROUP_SIZE]?.value
        ? Number.parseInt(inputs[PLAYOFF_GROUP_SIZE].value)
        : undefined;
      if (playoffDrawType) {
        structureOptions.playoffGroups = [
          {
            finishingPositions: [1],
            drawType: playoffDrawType,
            ...(playoffDrawType === ROUND_ROBIN && playoffGroupSize
              ? { structureOptions: { groupSize: playoffGroupSize } }
              : {}),
          },
        ];
      }
    }

    // Validate PAGE_PLAYOFF requires exactly 4 participants in the playoff
    if (validatePagePlayoff(structureOptions, inputs, groupSize) === false) return undefined;

    return structureOptions;
  } else if (drawType === ROUND_ROBIN) {
    return { groupSize };
  }

  return undefined;
}

function getSeedingPolicyDefinition(selectedSeedingPolicy: string): any {
  if (selectedSeedingPolicy === SEPARATE) {
    return POLICY_SEEDING_DEFAULT;
  } else if (selectedSeedingPolicy === CLUSTER) {
    return POLICY_SEEDING_ITF;
  } else if (selectedSeedingPolicy === INHERIT) {
    return undefined;
  }
  return POLICY_SEEDING_DEFAULT;
}

function handleQualifyingStructure(params: {
  structureId: string;
  qualifiersCount: number;
  structureOptions: any;
  matchUpFormat: string;
  structureName: string;
  automated: any;
  drawSize: number;
  drawType: string;
  drawId: string;
  eventId: string;
  callback?: (result: any) => void;
}): void {
  const {
    structureId,
    qualifiersCount,
    structureOptions,
    matchUpFormat,
    structureName,
    automated,
    drawSize,
    drawType,
    drawId,
    eventId,
    callback,
  } = params;

  const generationResult = tournamentEngine.generateQualifyingStructure({
    qualifyingPositions: qualifiersCount,
    targetStructureId: structureId,
    structureOptions,
    matchUpFormat,
    structureName,
    automated,
    drawSize,
    drawType,
    drawId,
  });

  if (generationResult.success) {
    const qualifyingStructureId = generationResult.structure?.structureId;
    const methods: any[] = [
      {
        method: ATTACH_QUALIFYING_STRUCTURE,
        params: {
          structure: generationResult.structure,
          link: generationResult.link,
          eventId,
          drawId,
        },
      },
    ];

    // Add qualifying entries to the draw so automatedPositioning can find them
    const event = tournamentEngine.getEvent({ eventId }).event;
    const qualifyingParticipantIds = (event?.entries ?? [])
      .filter((e: any) => e.entryStage === QUALIFYING && DIRECT_ENTRY_STATUSES.includes(e.entryStatus))
      .map((e: any) => e.participantId);
    if (qualifyingParticipantIds.length) {
      methods.push({
        method: ADD_DRAW_ENTRIES,
        params: { participantIds: qualifyingParticipantIds, entryStage: QUALIFYING, ignoreStageSpace: true, eventId, drawId },
      });
    }

    const postMutation = (result: any) => {
      if (result.success && automated && qualifyingStructureId) {
        const positionResult = tournamentEngine.automatedPositioning({
          structureId: qualifyingStructureId,
          applyPositioning: false,
          drawId,
        });
        if (positionResult.success && positionResult.positionAssignments?.length) {
          mutationRequest({
            methods: [
              {
                method: SET_POSITION_ASSIGNMENTS,
                params: {
                  structurePositionAssignments: [
                    { structureId: qualifyingStructureId, positionAssignments: positionResult.positionAssignments },
                  ],
                  structureId: qualifyingStructureId,
                  drawId,
                },
              },
            ],
            callback: (positionMutationResult: any) => {
              if (isFunction(callback)) callback({ ...generationResult, ...positionMutationResult.results?.[0] });
            },
          });
          return;
        }
      }
      if (isFunction(callback)) callback({ ...generationResult, ...result.results?.[0] });
    };
    mutationRequest({ methods, callback: postMutation });
  }
}

function configureDrawOptions(params: {
  isQualifying: boolean;
  existingDrawName?: string;
  qualifiersCount: number;
  structureOptions: any;
  matchUpFormat: string;
  structureName: string;
  seedsCount: number;
  drawSize: number;
  drawType: string;
  drawName: string;
  eventId: string;
  drawOptions: any;
}): void {
  const {
    isQualifying,
    existingDrawName,
    qualifiersCount,
    structureOptions,
    matchUpFormat,
    structureName,
    seedsCount,
    drawSize,
    drawType,
    drawName,
    eventId,
    drawOptions,
  } = params;

  if (isQualifying) {
    drawOptions.drawName = existingDrawName || drawName;
    drawOptions.qualifyingProfiles = [
      {
        structureProfiles: [
          {
            qualifyingPositions: qualifiersCount,
            structureOptions,
            matchUpFormat,
            structureName,
            seedsCount,
            drawSize,
            drawType,
          },
        ],
      },
    ];
  } else {
    if (qualifiersCount) {
      drawOptions.qualifiersCount = qualifiersCount;
      drawOptions.qualifyingPlaceholder = true;
    }
    Object.assign(drawOptions, {
      seedingScaleName: eventId,
      structureOptions,
      matchUpFormat,
      seedsCount,
      drawName,
      drawSize,
      drawType,
    });
  }
}

function handleDrawGeneration(params: {
  drawOptions: any;
  tieFormatName: string;
  seedingPolicyDefinition: any;
  eventId: string;
  callback?: (result: any) => void;
}): void {
  const { drawOptions, tieFormatName, seedingPolicyDefinition, eventId, callback } = params;

  if (tieFormatName === CUSTOM) {
    const setTieFormat = (tieFormat: any) => {
      if (tieFormat) {
        drawOptions.tieFormat = tieFormat;
        generateDraw({ drawOptions, eventId, callback });
      }
    };
    editTieFormat({ title: t('drawers.addDraw.customScorecard'), tieFormat: undefined, onClose: setTieFormat });
  } else {
    drawOptions.tieFormatName = tieFormatName;

    if (seedingPolicyDefinition) {
      drawOptions.policyDefinitions = {
        ...drawOptions.policyDefinitions,
        ...seedingPolicyDefinition,
      };
    }

    generateDraw({ drawOptions, eventId, callback });
  }
}

export function submitDrawParams({
  drawName: existingDrawName,
  matchUpFormat: providedMatchUpFormat,
  isPopulateMain,
  isQualifying,
  structureId,
  callback,
  inputs,
  drawId,
  event,
}: {
  drawName?: string;
  matchUpFormat?: string;
  isPopulateMain?: boolean;
  isQualifying?: boolean;
  structureId?: string;
  callback?: (result: any) => void;
  inputs: any;
  drawId?: string;
  event: any;
}): void {
  const isQualifyingFirst = inputs[QUALIFYING_FIRST]?.checked && !drawId && !structureId;
  const rawDrawType = inputs[DRAW_TYPE].options[inputs[DRAW_TYPE].selectedIndex].getAttribute('value');
  const isDrawMatic = rawDrawType === DRAW_MATIC;

  const FIC_DEPTH_MAP: Record<string, string> = {
    F: FEED_IN_CHAMPIONSHIP,
    SF: FEED_IN_CHAMPIONSHIP_TO_SF,
    QF: FEED_IN_CHAMPIONSHIP_TO_QF,
    R16: FEED_IN_CHAMPIONSHIP_TO_R16,
  };
  const resolvedFIC =
    rawDrawType === FEED_IN_CHAMPIONSHIP ? FIC_DEPTH_MAP[inputs[FIC_DEPTH]?.value] || FEED_IN_CHAMPIONSHIP : undefined;

  const drawType = resolvedFIC || (isDrawMatic ? AD_HOC : rawDrawType);
  const matchUpFormat = providedMatchUpFormat || inputs[MATCHUP_FORMAT]?.value;
  const selectedSeedingPolicy = inputs[SEEDING_POLICY]?.value;

  const flightProfile = event?.extensions?.find(
    (ext: any) => ext.name === factoryConstants.extensionConstants.FLIGHT_PROFILE,
  )?.value;
  const flight = flightProfile?.flights?.find((f: any) => f.drawId === drawId);

  const structureName = inputs[STRUCTURE_NAME]?.value;
  const tieFormatName = inputs.tieFormatName?.value;
  const drawName = inputs[DRAW_NAME]?.value;

  const drawSizeValue = inputs[DRAW_SIZE].value || 0;
  const drawSizeInteger = tools.isConvertableInteger(drawSizeValue) && Number.parseInt(drawSizeValue);
  const effectiveIsQualifying = isQualifying || isQualifyingFirst;
  const drawSize =
    ([ADAPTIVE, LUCKY_DRAW, FEED_IN, ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF, AD_HOC, SWISS].includes(drawType) && drawSizeInteger) ||
    (effectiveIsQualifying && drawSizeInteger) ||
    tools.nextPowerOf2(drawSizeInteger);
  const qualifyingEntries = event.entries.filter(
    ({ entryStage, entryStatus }: any) => entryStage === QUALIFYING && DIRECT_ENTRY_STATUSES.includes(entryStatus),
  );
  const mainEntriesFromEvent = event.entries.filter(
    ({ entryStage, entryStatus }: any) =>
      (!entryStage || entryStage === MAIN) && DIRECT_ENTRY_STATUSES.includes(entryStatus),
  );
  // flight.drawEntries may only contain one stage (e.g. qualifying-first creates
  // a flight with QUALIFYING entries only); fall through to event MAIN entries
  // when the flight has no main entries.
  const flightMainEntries = (flight?.drawEntries || []).filter(
    ({ entryStage, entryStatus }: any) =>
      (!entryStage || entryStage === MAIN) && DIRECT_ENTRY_STATUSES.includes(entryStatus),
  );
  const drawEntries =
    effectiveIsQualifying && qualifyingEntries.length
      ? qualifyingEntries
      : flightMainEntries.length
        ? flightMainEntries
        : mainEntriesFromEvent;

  const creationValue = inputs[AUTOMATED].value;
  const isDraft = creationValue === DRAFT;
  const isLucky = drawType === LUCKY_DRAW;
  const automated =
    drawSize < drawEntries.length
      ? false
      : isDraft
        ? { seedsOnly: true }
        : isLucky || creationValue === AUTOMATED;

  const eventId = event.eventId;
  const drawOptions: any = {
    drawEntries,
    automated,
    eventId,
    drawId,
    isDraft,
  };

  const structureOptions = getStructureOptions(drawType, inputs);
  if (structureOptions === undefined && drawType === ROUND_ROBIN_WITH_PLAYOFF) return;

  if (drawType === AD_HOC) {
    if (isDrawMatic) {
      const roundsCount = Number.parseInt(inputs[ROUNDS_COUNT]?.value) || 1;
      const selectedScale = inputs[RATING_SCALE]?.value || '';
      const dynamicRatings = inputs[DYNAMIC_RATINGS]?.checked || false;
      const teamAvoidance = inputs[TEAM_AVOIDANCE]?.checked || false;
      Object.assign(drawOptions, {
        automated: true,
        roundsCount,
        drawMatic: {
          dynamicRatings,
          convertToELO: dynamicRatings,
          ...(selectedScale && { scaleName: selectedScale.toUpperCase() }),
          ...(teamAvoidance === false && { sameTeamValue: 0 }),
        },
      });
    } else {
      Object.assign(drawOptions, { roundsCount: 1 });
    }
  }

  if (drawType === SWISS) {
    const selectedScale = inputs[RATING_SCALE]?.value || '';
    Object.assign(drawOptions, {
      automated: false,
      ...(selectedScale && { scaleName: selectedScale.toUpperCase() }),
    });
  }

  const seedingPolicyDefinition = getSeedingPolicyDefinition(selectedSeedingPolicy);

  const seedsCount = tournamentEngine.getSeedsCount({
    participantsCount: drawEntries?.length,
    policyDefinitions: seedingPolicyDefinition || POLICY_SEEDING,
    drawSizeProgression: true,
  })?.seedsCount;

  const qualifiersCount = isQualifyingFirst
    ? (validators.numericValidator(inputs[QUALIFYING_POSITIONS]?.value) && Number.parseInt(inputs[QUALIFYING_POSITIONS]?.value)) || 4
    : (validators.numericValidator(inputs[QUALIFIERS_COUNT].value) && Number.parseInt(inputs[QUALIFIERS_COUNT]?.value)) || 0;

  if (structureId && drawId) {
    handleQualifyingStructure({
      structureId,
      qualifiersCount,
      structureOptions,
      matchUpFormat,
      structureName,
      automated,
      drawSize,
      drawType,
      drawId,
      eventId,
      callback,
    });
    return;
  }

  const requiredPositions = drawEntries.length + qualifiersCount;
  if (!effectiveIsQualifying && !isPopulateMain && qualifiersCount && drawSize < requiredPositions) {
    tmxToast({
      message: `Draw size (${drawSize}) must be at least ${requiredPositions} (${drawEntries.length} entries + ${qualifiersCount} qualifiers)`,
      intent: 'is-warning',
      pauseOnHover: true,
    });
    return;
  }

  // Qualifying-first: add qualifyingOnly flag so factory creates MAIN placeholder
  if (isQualifyingFirst) {
    drawOptions.qualifyingOnly = true;
  }

  configureDrawOptions({
    isQualifying: effectiveIsQualifying ?? false,
    existingDrawName,
    qualifiersCount,
    structureOptions,
    matchUpFormat,
    structureName,
    seedsCount,
    drawSize,
    drawType,
    drawName,
    eventId,
    drawOptions,
  });

  // Qualifying-first: wrap callback to auto-position qualifying entries after draw creation
  const effectiveCallback = isQualifyingFirst && automated
    ? (result: any) => {
        const qualifyingStructureId = result.drawDefinition?.structures?.find(
          (s: any) => s.stage === QUALIFYING,
        )?.structureId;
        const generatedDrawId = result.drawDefinition?.drawId;
        if (qualifyingStructureId && generatedDrawId) {
          const positionResult = tournamentEngine.automatedPositioning({
            structureId: qualifyingStructureId,
            applyPositioning: false,
            drawId: generatedDrawId,
          });
          if (positionResult.success && positionResult.positionAssignments?.length) {
            mutationRequest({
              methods: [
                {
                  method: SET_POSITION_ASSIGNMENTS,
                  params: {
                    structurePositionAssignments: [
                      { structureId: qualifyingStructureId, positionAssignments: positionResult.positionAssignments },
                    ],
                    structureId: qualifyingStructureId,
                    drawId: generatedDrawId,
                  },
                },
              ],
              callback: () => {
                if (isFunction(callback)) callback(result);
              },
            });
            return;
          }
        }
        if (isFunction(callback)) callback(result);
      }
    : callback;

  if (drawSizeInteger) {
    handleDrawGeneration({ drawOptions, tieFormatName, seedingPolicyDefinition, eventId, callback: effectiveCallback });
  } else {
    tmxToast({
      message: t('drawers.addDraw.invalidDrawSize'),
      intent: 'is-warning',
      pauseOnHover: true,
    });
  }
}
