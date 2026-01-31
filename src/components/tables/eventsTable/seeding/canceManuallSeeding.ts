import { drawDefinitionConstants, entryStatusConstants, tournamentEngine } from 'tods-competition-factory';
import { hideSaveSeeding } from './hideSaveSeeding';
import { removeSeeding } from './removeSeeding';

import { RIGHT } from 'constants/tmxConstants';

const { DIRECT_ACCEPTANCE } = entryStatusConstants;
const { QUALIFYING } = drawDefinitionConstants;

const getSeedNumber = (participant: any, eventType: string, scaleName: string) => {
  const seedings = participant?.seedings?.[eventType];
  if (!seedings) return undefined;
  const scaleItem = seedings.find((item: any) => item.scaleName === scaleName);
  return scaleItem?.scaleValue;
};

const onCancelManualSeedingClick = (
  e: any,
  table: any,
  eventId: string,
  DIRECT_ACCEPTANCE: string,
  QUALIFYING: string,
) => {
  hideSaveSeeding(e, table);
  const entryStage = removeSeeding({ table });
  const event = tournamentEngine.getEvent({ eventId })?.event;
  const entries = event.entries?.filter(
    (entry: any) => entry.entryStage === entryStage && entry.entryStatus === DIRECT_ACCEPTANCE,
  );
  const participantIds = entries.map(({ participantId }: any) => participantId);
  const { participants } = tournamentEngine.getParticipants({
    participantFilters: { participantIds },
    withScaleValues: true,
  });

  const scaleName = entryStage === QUALIFYING ? `${eventId}${QUALIFYING}` : eventId;

  const seededParticipants = participants
    .map((participant: any) => {
      const seedNumber = getSeedNumber(participant, event.eventType, scaleName);
      if (seedNumber) return { participantId: participant.participantId, seedNumber };
      return undefined;
    })
    .filter(Boolean);

  const seedMap = Object.assign({}, ...seededParticipants.map((p: any) => ({ [p.participantId]: p })));

  const rows = table.getRows();
  for (const row of rows) {
    const data = row.getData();
    const participantId = data.participantId;
    if (seedMap[participantId]) {
      data.seedNumber = seedMap[participantId].seedNumber;
      row.update(data);
    }
  }
};

export const cancelManualSeeding =
  (event: any) =>
  (table: any): any => {
    const eventId = event?.eventId;

    const onClick = (e: any) => onCancelManualSeedingClick(e, table, eventId, DIRECT_ACCEPTANCE, QUALIFYING);

    return {
      class: 'cancelManualSeeding',
      intent: 'is-warning',
      location: RIGHT,
      label: 'Cancel',
      visible: false,
      onClick,
    };
  };
