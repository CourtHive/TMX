import { drawDefinitionConstants, scaleConstants } from 'tods-competition-factory';
import { setParticipantScaleItems } from './setParticipantScaleItems';

const { QUALIFYING } = drawDefinitionConstants;
const { SEEDING, MANUAL } = scaleConstants;

export function saveSeedingValues({ event, rows, callback }) {
  const { eventId, eventType } = event;
  const scaleItemsWithParticipantIds = rows.map(({ entryStage, participantId, seedNumber }) => {
    const scaleName = entryStage === QUALIFYING ? `${eventId}${QUALIFYING}` : eventId;
    return {
      participantId,
      scaleItems: [
        {
          scaleValue: seedNumber,
          scaleType: SEEDING,
          scaleName,
          eventType
        }
      ]
    };
  });

  setParticipantScaleItems({ scaleItemsWithParticipantIds, scaleBasis: MANUAL, eventId, callback });
}
