import { updateTieFormat } from 'components/overlays/editTieFormat.js/updateTieFormat';
import { deleteFlights } from 'components/modals/deleteFlights';
import { eventConstants } from 'tods-competition-factory';
import { editMatchUpFormat } from './editMatchUpFormat';
import { removeStructure } from './removeStructure';

const { TEAM } = eventConstants;

export function getActionOptions({ eventData, drawData, drawId, structureId, structureName }) {
  const structure = drawData.structures?.find((structure) => structure.structureId === structureId);
  const eventId = eventData.eventInfo.eventId;

  return [
    {
      hide: eventData.eventInfo.eventType !== TEAM,
      onClick: () => updateTieFormat({ structureId, eventId, drawId }),
      label: 'Edit scorecard',
      close: true
    },
    {
      hide: eventData.eventInfo.eventType === TEAM,
      onClick: () => editMatchUpFormat({ structureId, eventId, drawId }),
      label: `Edit ${structureName} scoring`,
      close: true
    },
    {
      hide: structure?.stage === 'MAIN' && structure.stageSequence === 1,
      onClick: () => removeStructure({ drawId, eventId, structureId }),
      label: 'Remove structure',
      close: true
    },
    {
      onClick: () => deleteFlights({ eventData, drawIds: [drawId] }),
      label: 'Delete draw'
    }
  ];
}
