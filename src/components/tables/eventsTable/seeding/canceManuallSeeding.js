import { drawDefinitionConstants, entryStatusConstants, tournamentEngine } from 'tods-competition-factory';
import { hideSaveSeeding } from './hideSaveSeeding';
import { removeSeeding } from './removeSeeding';

import { RIGHT } from 'constants/tmxConstants';

const { DIRECT_ACCEPTANCE } = entryStatusConstants;
const { QUALIFYING } = drawDefinitionConstants;

export const cancelManualSeeding = (event) => (table) => {
  const eventId = event?.eventId;

  const onClick = (e) => {
    hideSaveSeeding(e, table);
    const entryStage = removeSeeding({ table });
    const event = tournamentEngine.getEvent({ eventId })?.event;
    const entries = event.entries?.filter(
      (entry) => entry.entryStage === entryStage && entry.entryStatus === DIRECT_ACCEPTANCE
    );
    const participantIds = entries.map(({ participantId }) => participantId);
    const { participants } = tournamentEngine.getParticipants({
      participantFilters: { participantIds },
      withScaleValues: true
    });

    const scaleName = entryStage === QUALIFYING ? `${eventId}${QUALIFYING}` : eventId;

    const seededParticipants = participants
      .map((participant) => {
        const seedNumber = participant?.seedings?.[event.eventType]?.find(
          (scaleItem) => scaleItem.scaleName === scaleName
        )?.scaleValue;
        if (seedNumber) return { participantId: participant.participantId, seedNumber };
      })
      .filter(Boolean);

    const seedMap = Object.assign({}, ...seededParticipants.map((p) => ({ [p.participantId]: p })));

    // restore current seeding
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

  return {
    class: 'cancelManualSeeding',
    intent: 'is-warning',
    location: RIGHT,
    label: 'Cancel',
    visible: false,
    onClick
  };
};
