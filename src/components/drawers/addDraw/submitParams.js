import { drawDefinitionConstants, entryStatusConstants, tournamentEngine, utilities } from 'tods-competition-factory';
import { editTieFormat } from 'components/overlays/editTieFormat.js/editTieFormat';
import { tmxToast } from 'services/notifications/tmxToast';
import { generateDraw } from './generateDraw';

import { AUTOMATED, CUSTOM, GROUP_REMAINING, PLAYOFF_TYPE, POSITIONS, TOP_FINISHERS } from 'constants/tmxConstants';
import POLICY_SEEDING from 'assets/policies/seedingPolicy';

const { FEED_IN, LUCKY_DRAW, MAIN, ROUND_ROBIN, ROUND_ROBIN_WITH_PLAYOFF } = drawDefinitionConstants;
const { DIRECT_ENTRY_STATUSES } = entryStatusConstants;

export function submitParams({ event, inputs, callback, matchUpFormat }) {
  const drawType = inputs.drawType.options[inputs.drawType.selectedIndex].getAttribute('value');
  matchUpFormat = matchUpFormat || inputs.matchUpFormat?.value;
  const automated = inputs.automated.value === AUTOMATED;
  const tieFormatName = inputs.tieFormatName?.value;
  const drawName = inputs.drawName.value;

  const drawSizeValue = inputs.drawSize.value;
  const groupSize = parseInt(inputs.groupSize.value);
  const drawSizeInteger = utilities.isConvertableInteger(drawSizeValue) && parseInt(drawSizeValue);
  const drawSize =
    ([LUCKY_DRAW, FEED_IN].includes(drawType) && drawSizeInteger) || utilities.nextPowerOf2(drawSizeInteger);
  const drawEntries = event.entries.filter(
    ({ entryStage, entryStatus }) => entryStage === MAIN && DIRECT_ENTRY_STATUSES.includes(entryStatus)
  );

  const seedsCount = tournamentEngine.getSeedsCount({
    participantCount: drawEntries?.length,
    policyDefinitions: POLICY_SEEDING,
    drawSizeProgression: true
  })?.seedsCount;

  const eventId = event.eventId;
  const drawOptions = {
    seedingScaleName: eventId,
    matchUpFormat,
    drawEntries,
    seedsCount,
    automated,
    drawType,
    drawName,
    drawSize,
    eventId
  };

  // ROUND_ROBIN_WITH_PLAYOFFS
  const advancePerGroup = parseInt(inputs.advancePerGroup?.value || 0);
  const groupRemaining = inputs[GROUP_REMAINING]?.checked;
  const playoffType = inputs[PLAYOFF_TYPE]?.value;

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

    drawOptions.structureOptions = { groupSize };
    if (playoffGroups.length) {
      // NOTE: if no playoffGroups are specified, defaults to placing "winners" of each group in playoff
      drawOptions.structureOptions.playoffGroups = playoffGroups;
    }
  } else if (drawType === ROUND_ROBIN) {
    drawOptions.structureOptions = { groupSize };
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
