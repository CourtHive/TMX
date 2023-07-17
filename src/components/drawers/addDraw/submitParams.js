import { drawDefinitionConstants, entryStatusConstants, tournamentEngine, utilities } from 'tods-competition-factory';
import { editTieFormat } from 'components/overlays/editTieFormat.js/editTieFormat';
import { numericValidator } from 'components/validators/numericValidator';
import { tmxToast } from 'services/notifications/tmxToast';
import { generateDraw } from './generateDraw';

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

const { FEED_IN, LUCKY_DRAW, MAIN, QUALIFYING, ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF } = drawDefinitionConstants;
const { DIRECT_ENTRY_STATUSES } = entryStatusConstants;

export function submitParams({
  drawName: existingDrawName,
  matchUpFormat,
  isQualifying,
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
  }

  const seedsCount = tournamentEngine.getSeedsCount({
    participantCount: drawEntries?.length,
    policyDefinitions: POLICY_SEEDING,
    drawSizeProgression: true
  })?.seedsCount;

  const eventId = event.eventId;
  const drawOptions = {
    automated,
    eventId,
    drawId
  };

  const qualifiersCount =
    (numericValidator(inputs[QUALIFIERS_COUNT].value) && parseInt(inputs[QUALIFIERS_COUNT]?.value)) || 0;

  if (isQualifying) {
    console.log({ qualifyingEntries, existingDrawName });
    drawOptions.drawName = existingDrawName;
    drawOptions.qualifyingProfiles = [
      {
        structureProfiles: [
          {
            qualifyingPositions: qualifiersCount,
            structureOptions,
            matchUpFormat,
            structureName,
            drawEntries,
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
      drawEntries,
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
