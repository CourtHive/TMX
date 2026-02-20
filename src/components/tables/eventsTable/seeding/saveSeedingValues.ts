import { drawDefinitionConstants, scaleConstants } from 'tods-competition-factory';
import { setParticipantScaleItems } from './setParticipantScaleItems';

const { QUALIFYING } = drawDefinitionConstants;
const { SEEDING } = scaleConstants;
const MANUAL = 'MANUAL';

type SaveSeedingValuesParams = {
  event: any;
  rows: any[];
  callback?: () => void;
};

export function saveSeedingValues({ event, rows, callback }: SaveSeedingValuesParams): void {
  const { eventId, eventType } = event;
  const scaleItemsWithParticipantIds = rows.map(({ entryStage, participantId, seedNumber }: any) => {
    const scaleName = entryStage === QUALIFYING ? `${eventId}${QUALIFYING}` : eventId;
    return {
      participantId,
      scaleItems: [
        {
          scaleValue: seedNumber,
          scaleType: SEEDING,
          scaleName,
          eventType,
        },
      ],
    };
  });

  setParticipantScaleItems({ scaleItemsWithParticipantIds, scaleBasis: MANUAL, eventId, callback });
}
