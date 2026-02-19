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

import { ATTACH_QUALIFYING_STRUCTURE } from 'constants/mutationConstants';
import POLICY_SEEDING from 'assets/policies/seedingPolicy';
import {
  AUTOMATED,
  CUSTOM,
  DRAW_NAME,
  DRAW_SIZE,
  DRAW_TYPE,
  GROUP_REMAINING,
  GROUP_SIZE,
  MATCHUP_FORMAT,
  PLAYOFF_TYPE,
  POSITIONS,
  QUALIFIERS_COUNT,
  SEEDING_POLICY,
  STRUCTURE_NAME,
  TOP_FINISHERS,
} from 'constants/tmxConstants';

const { AD_HOC, FEED_IN, LUCKY_DRAW, MAIN, QUALIFYING, ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF, SEPARATE, CLUSTER } =
  drawDefinitionConstants;
const { TIME_TENNIS_PRO_CIRCUIT } = factoryConstants.tieFormatConstants;
const { DIRECT_ENTRY_STATUSES } = entryStatusConstants;
const { POLICY_TYPE_ROUND_NAMING, POLICY_TYPE_SEEDING } = policyConstants;

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
): any[] {
  const playoffGroups: any[] = [];

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
      });
    });
  } else if (playoffType === POSITIONS) {
    tools.generateRange(1, groupSize + 1).forEach((c) => {
      playoffGroups.push({
        structureName: `Playoff ${c}`,
        finishingPositions: [c],
      });
    });
  }

  return playoffGroups;
}

function getStructureOptions(drawType: string, inputs: any): any {
  const groupSize = Number.parseInt(inputs[GROUP_SIZE].value);

  if (drawType === ROUND_ROBIN_WITH_PLAYOFF) {
    const advancePerGroup = Number.parseInt(inputs.advancePerGroup?.value || 0);
    const groupRemaining = inputs[GROUP_REMAINING]?.checked;
    const playoffType = inputs[PLAYOFF_TYPE]?.value;
    const playoffGroups = getPlayoffGroups(playoffType, advancePerGroup, groupRemaining, groupSize);

    const structureOptions: any = { groupSize };
    if (playoffGroups.length) {
      structureOptions.playoffGroups = playoffGroups;
    }
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
  automated: boolean;
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
    const methods = [
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
    const postMutation = (result: any) => {
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
    drawOptions.drawName = existingDrawName;
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

    if (tieFormatName === TIME_TENNIS_PRO_CIRCUIT) {
      const customRoundNamingPolicy = {
        [POLICY_TYPE_ROUND_NAMING]: {
          namingConventions: { round: 'Day' },
          affixes: { roundNumber: 'D' },
          policyName: 'TTPro 4 Day',
        },
      };
      drawOptions.policyDefinitions = {
        ...drawOptions.policyDefinitions,
        ...customRoundNamingPolicy,
      };
    }

    generateDraw({ drawOptions, eventId, callback });
  }
}

export function submitDrawParams({
  drawName: existingDrawName,
  matchUpFormat: providedMatchUpFormat,
  isQualifying,
  structureId,
  callback,
  inputs,
  drawId,
  event,
}: {
  drawName?: string;
  matchUpFormat?: string;
  isQualifying?: boolean;
  structureId?: string;
  callback?: (result: any) => void;
  inputs: any;
  drawId?: string;
  event: any;
}): void {
  const drawType = inputs[DRAW_TYPE].options[inputs[DRAW_TYPE].selectedIndex].getAttribute('value');
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
  const drawSize =
    ([LUCKY_DRAW, FEED_IN, ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF].includes(drawType) && drawSizeInteger) ||
    tools.nextPowerOf2(drawSizeInteger);
  const qualifyingEntries = event.entries.filter(
    ({ entryStage, entryStatus }: any) => entryStage === QUALIFYING && DIRECT_ENTRY_STATUSES.includes(entryStatus),
  );
  const drawEntries =
    isQualifying && qualifyingEntries.length
      ? qualifyingEntries
      : flight?.drawEntries ||
        event.entries.filter(
          ({ entryStage, entryStatus }: any) =>
            (!entryStage || entryStage === MAIN) && DIRECT_ENTRY_STATUSES.includes(entryStatus),
        );

  const automated = drawSize < drawEntries.length ? false : inputs[AUTOMATED].value === AUTOMATED;

  const eventId = event.eventId;
  const drawOptions: any = {
    drawEntries,
    automated,
    eventId,
    drawId,
  };

  const structureOptions = getStructureOptions(drawType, inputs);

  if (drawType === AD_HOC) {
    Object.assign(drawOptions, { roundsCount: 1 });
  }

  const seedingPolicyDefinition = getSeedingPolicyDefinition(selectedSeedingPolicy);

  const seedsCount = tournamentEngine.getSeedsCount({
    participantsCount: drawEntries?.length,
    policyDefinitions: seedingPolicyDefinition || POLICY_SEEDING,
    drawSizeProgression: true,
  })?.seedsCount;

  const qualifiersCount =
    (validators.numericValidator(inputs[QUALIFIERS_COUNT].value) && Number.parseInt(inputs[QUALIFIERS_COUNT]?.value)) ||
    0;

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

  configureDrawOptions({
    isQualifying: isQualifying ?? false,
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

  if (drawSizeInteger) {
    handleDrawGeneration({ drawOptions, tieFormatName, seedingPolicyDefinition, eventId, callback });
  } else {
    tmxToast({
      message: t('drawers.addDraw.invalidDrawSize'),
      intent: 'is-warning',
      pauseOnHover: true,
    });
  }
}
