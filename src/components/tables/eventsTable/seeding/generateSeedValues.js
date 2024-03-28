import { tournamentEngine, drawDefinitionConstants, scaleConstants, fixtures } from 'tods-competition-factory';
import { setParticipantScaleItems } from './setParticipantScaleItems';
import { isFunction } from 'functions/typeOf';

import { GENERATE_SEEDING_SCALE_ITEMS } from 'constants/mutationConstants';
import POLICY_SEEDING from 'assets/policies/seedingPolicy';

const { QUALIFYING, MAIN } = drawDefinitionConstants;
const { SEEDING, RATING } = scaleConstants;
const { ratingsParameters } = fixtures;

const bands = { high: [80, 100], medium: [60, 80], low: [40, 60] };

export function generateSeedValues({ event, group, table, field }) {
  const { eventId, eventType } = event;
  const { seedsCount, stageEntries } = tournamentEngine.getEntriesAndSeedsCount({
    stage: group === QUALIFYING ? QUALIFYING : MAIN,
    policyDefinitions: POLICY_SEEDING,
    eventId,
  });

  const [scaleType, rating, accessor] = field.split('.');
  const getRating = (participant) => participant.ratings?.[rating] || { confidence: 0, [accessor]: Infinity };
  const getRatingValue = (participant) => getRating(participant)?.[accessor] || 0;
  const reversed = rating ? !ratingsParameters[rating.toUpperCase()].ascending : false;

  const scaleSort = (a, b) =>
    (scaleType === 'ratings' && reversed
      ? getRatingValue(a) - getRatingValue(b)
      : getRatingValue(b) - getRatingValue(a)) || a - b;
  const data = table.getData();
  const bandedParticipants = { high: [], medium: [], low: [] };

  let ratedParticipants = 0;
  for (const participant of data) {
    const rating = getRating(participant);
    if (rating[accessor]) ratedParticipants += 1;

    if (rating.confidence || 100 >= bands.high[0]) {
      bandedParticipants.high.push(participant);
    } else if (rating.confidence >= bands.medium[0] && rating.confidence < bands.medium[1]) {
      bandedParticipants.medium.push(participant);
    } else if (rating.confidence >= bands.low[0] && rating.confidence < bands.low[1]) {
      bandedParticipants.low.push(participant);
    }
  }

  const sortedBy =
    isFunction(scaleSort) &&
    [].concat(
      bandedParticipants.high.toSorted(scaleSort),
      bandedParticipants.medium.toSorted(scaleSort),
      bandedParticipants.low.toSorted(scaleSort),
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
      rowData.seedNumber = seedNumber;
      row.update(rowData);
    }
  };

  setParticipantScaleItems({ scaleItemsWithParticipantIds, scaleBasis: RATING, eventId, callback });
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
