import { editTieFormat } from 'components/overlays/editTieFormat.js/editTieFormat';
import { numericValidator } from 'components/validators/numericValidator';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { generateDraw } from './generateDraw';
import { isFunction } from 'functions/typeOf';
import {
  drawDefinitionConstants,
  entryStatusConstants,
  factoryConstants,
  tournamentEngine,
  utilities,
  policyConstants
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
  STRUCTURE_NAME,
  TOP_FINISHERS
} from 'constants/tmxConstants';

const { AD_HOC, FEED_IN, LUCKY_DRAW, MAIN, QUALIFYING, ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF } =
  drawDefinitionConstants;
const { TIME_TENNIS_PRO_CIRCUIT } = factoryConstants.tieFormatConstants;
const { DIRECT_ENTRY_STATUSES } = entryStatusConstants;
const { POLICY_TYPE_ROUND_NAMING } = policyConstants;

export function submitDrawParams({
  drawName: existingDrawName,
  matchUpFormat,
  isQualifying,
  structureId,
  callback,
  inputs,
  drawId,
  event
}) {
  const drawType = inputs[DRAW_TYPE].options[inputs[DRAW_TYPE].selectedIndex].getAttribute('value');
  matchUpFormat = matchUpFormat || inputs[MATCHUP_FORMAT]?.value;

  const structureName = inputs[STRUCTURE_NAME]?.value;
  const tieFormatName = inputs.tieFormatName?.value;
  const drawName = inputs[DRAW_NAME]?.value;

  const drawSizeValue = inputs[DRAW_SIZE].value || 0;
  const groupSize = parseInt(inputs[GROUP_SIZE].value);
  const drawSizeInteger = utilities.isConvertableInteger(drawSizeValue) && parseInt(drawSizeValue);
  const drawSize =
    ([LUCKY_DRAW, FEED_IN, ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF].includes(drawType) && drawSizeInteger) ||
    utilities.nextPowerOf2(drawSizeInteger);
  const qualifyingEntries = event.entries.filter(
    ({ entryStage, entryStatus }) => entryStage === QUALIFYING && DIRECT_ENTRY_STATUSES.includes(entryStatus)
  );
  const drawEntries =
    isQualifying && qualifyingEntries.length
      ? qualifyingEntries
      : event.entries.filter(
          ({ entryStage, entryStatus }) => entryStage === MAIN && DIRECT_ENTRY_STATUSES.includes(entryStatus)
        );

  // default to Manual if the drawSize is less than the number of entries
  const automated = drawSize < drawEntries.length ? false : inputs[AUTOMATED].value === AUTOMATED;

  const eventId = event.eventId;
  const drawOptions = {
    drawEntries,
    automated,
    eventId,
    drawId
  };

  // ROUND_ROBIN_WITH_PLAYOFFS
  const advancePerGroup = parseInt(inputs.advancePerGroup?.value || 0);
  const groupRemaining = inputs[GROUP_REMAINING]?.checked;
  const playoffType = inputs[PLAYOFF_TYPE]?.value;
  let structureOptions;

  if (drawType === ROUND_ROBIN_WITH_PLAYOFF) {
    const playoffGroups = [];
    if (playoffType === TOP_FINISHERS) {
      const groups = [utilities.generateRange(1, advancePerGroup + 1)];
      if (groupRemaining) {
        const group = utilities.generateRange(advancePerGroup + 1, groupSize + 1);
        if (group.length) groups.push(group);
      }
      groups.forEach((finishingPositions, i) => {
        playoffGroups.push({
          structureName: `Playoff ${i + 1}`,
          finishingPositions
        });
      });
    } else if (playoffType === POSITIONS) {
      utilities.generateRange(1, groupSize + 1).forEach((c) => {
        playoffGroups.push({
          structureName: `Playoff ${c}`,
          finishingPositions: [c]
        });
      });
    }

    structureOptions = { groupSize };
    if (playoffGroups.length) {
      // NOTE: if no playoffGroups are specified, defaults to placing "winners" of each group in playoff
      structureOptions.playoffGroups = playoffGroups;
    }
  } else if (drawType === ROUND_ROBIN) {
    structureOptions = { groupSize };
  } else if (drawType === AD_HOC) {
    Object.assign(drawOptions, { roundsCount: 1 });
  }

  const seedsCount = tournamentEngine.getSeedsCount({
    participantsCount: drawEntries?.length,
    policyDefinitions: POLICY_SEEDING,
    drawSizeProgression: true
  })?.seedsCount;

  const qualifiersCount =
    (numericValidator(inputs[QUALIFIERS_COUNT].value) && parseInt(inputs[QUALIFIERS_COUNT]?.value)) || 0;

  if (structureId) {
    // structureId is only present when a qualifying draw is being added to an existing structure
    // if structureId is { stage: MAIN, stageSequence: 1 } then allow automated positioning
    const generationResult = tournamentEngine.generateQualifyingStructure({
      qualifyingPositions: qualifiersCount,
      targetStructureId: structureId,
      structureOptions,
      matchUpFormat,
      structureName,
      automated,
      drawSize,
      drawType,
      drawId
    });

    if (generationResult.success) {
      const methods = [
        {
          method: ATTACH_QUALIFYING_STRUCTURE,
          params: {
            structure: generationResult.structure,
            link: generationResult.link,
            eventId,
            drawId
          }
        }
      ];
      const postMutation = (result) =>
        isFunction(callback) && callback({ ...generationResult, ...result.results?.[0] });
      mutationRequest({ methods, callback: postMutation });
    }

    return;
  }

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
            drawType
          }
        ]
      }
    ];
  } else {
    if (qualifiersCount) {
      drawOptions.qualifiersCount = qualifiersCount;
      drawOptions.qualifyingPlaceholder = true;
    }
    Object.assign(drawOptions, {
      seedingScaleName: eventId, // TODO: qualifying seeding needs to have a unique seedingScaleName
      structureOptions,
      matchUpFormat,
      seedsCount,
      drawName,
      drawSize,
      drawType
    });
  }

  if (drawSizeInteger) {
    if (tieFormatName === CUSTOM) {
      const setTieFormat = (tieFormat) => {
        if (tieFormat) {
          drawOptions.tieFormat = tieFormat;
          generateDraw({ drawOptions, eventId, callback });
        }
      };
      editTieFormat({ title: 'Custom scorecard', onClose: setTieFormat });
    } else {
      drawOptions.tieFormatName = tieFormatName;

      if (tieFormatName === TIME_TENNIS_PRO_CIRCUIT) {
        const customRoundNamingPolicy = {
          [POLICY_TYPE_ROUND_NAMING]: {
            namingConventions: { round: 'Day' },
            affixes: { roundNumber: 'D' },
            policyName: 'TTPro 4 Day'
          }
        };
        drawOptions.policyDefinitions = { ...customRoundNamingPolicy };
      }

      generateDraw({ drawOptions, eventId, callback });
    }
  } else {
    tmxToast({
      message: 'Invalid draw size',
      intent: 'is-warning',
      pauseOnHover: true
    });
  }
}
