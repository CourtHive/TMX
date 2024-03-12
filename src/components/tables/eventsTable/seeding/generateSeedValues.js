import { tournamentEngine, drawDefinitionConstants, scaleConstants } from 'tods-competition-factory';
import { setParticipantScaleItems } from './setParticipantScaleItems';
import { isFunction } from 'functions/typeOf';

import { GENERATE_SEEDING_SCALE_ITEMS } from 'constants/mutationConstants';
import POLICY_SEEDING from 'assets/policies/seedingPolicy';

const { QUALIFYING, MAIN } = drawDefinitionConstants;
const { SEEDING, RATING } = scaleConstants;

const bands = { high: [80, 100], medium: [60, 80], low: [40, 60] };

export function generateSeedValues({ event, group, table, field }) {
  const { eventId, eventType } = event;
  const { seedsCount, stageEntries } = tournamentEngine.getEntriesAndSeedsCount({
    stage: group === QUALIFYING ? QUALIFYING : MAIN,
    policyDefinitions: POLICY_SEEDING,
    eventId,
  });

  const wtnSort = (a, b) => getWtn(a).wtnRating - getWtn(b).wtnRating;
  const sortMethod = field === 'ratings.wtn.wtnRating' && wtnSort;
  const data = table.getData();
  const bandedParticipants = { high: [], medium: [], low: [] };

  let ratedParticipants = 0;
  for (const participant of data) {
    const wtn = getWtn(participant);
    if (wtn.wtnRating) ratedParticipants += 1;

    if (wtn.confidence >= bands.high[0]) {
      bandedParticipants.high.push(participant);
    } else if (wtn.confidence >= bands.medium[0] && wtn.confidence < bands.medium[1]) {
      bandedParticipants.medium.push(participant);
    } else if (wtn.confidence >= bands.low[0] && wtn.confidence < bands.low[1]) {
      bandedParticipants.low.push(participant);
    }
  }

  const sortedBy =
    isFunction(sortMethod) &&
    [].concat(
      bandedParticipants.high.toSorted(sortMethod),
      bandedParticipants.medium.toSorted(sortMethod),
      bandedParticipants.low.toSorted(sortMethod),
    );

  const scaledEntries = sortedBy.slice(0, Math.min(ratedParticipants, seedsCount));

  const scaleName = group === QUALIFYING ? `${eventId}${QUALIFYING}` : eventId;
  const scaleAttributes = {
    scaleType: SEEDING,
    scaleName,
    eventType,
  };
  const { scaleItemsWithParticipantIds } = tournamentEngine.generateSeedingScaleItems({
    scaleAttributes,
    scaledEntries,
    stageEntries,
    seedsCount,
    scaleName,
  });

  const callback = () => {
    const seedsMap = Object.assign(
      {},
      ...scaledEntries.map((participant, i) => ({ [participant.participantId]: i + 1 })),
    );

    const rows = table.getRows();
    table.showColumn('seedNumber');
    table.redraw(true);

    for (const row of rows) {
      const rowData = row.getData();
      const seedNumber = seedsMap[rowData.participantId];
      if (seedNumber) {
        rowData.seedNumber = seedNumber;
        row.update(rowData);
      }
    }
  };

  setParticipantScaleItems({ scaleItemsWithParticipantIds, scaleBasis: RATING, eventId, callback });
}

function getWtn(participant) {
  return participant.ratings?.wtn || { confidence: 0, wtnRating: Infinity };
}

export function generateSeedingScaleItems() {
  // getScaledEntries...
  return {
    method: GENERATE_SEEDING_SCALE_ITEMS,
    params: {
      scaledEntries: [
        // { participantId: 'pid', value: '33', order: 1 },
      ],
      seedsCount: 8,
      scaleAttributes: {
        // scaleName: eventId, scaleType: 'RANKING', eventType: 'SINGLES'
      },
      scaleName: 'eventId',
      stageEntries: [
        // { participantId: 'pid', entryStatus, entryStage, entryPosition }
      ],
    },
  };
}
