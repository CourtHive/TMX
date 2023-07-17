import { updateTieFormat } from 'components/overlays/editTieFormat.js/updateTieFormat';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { deleteFlights } from 'components/modals/deleteFlights';
import { eventConstants } from 'tods-competition-factory';
import { editMatchUpFormat } from './editMatchUpFormat';

const { TEAM } = eventConstants;

export function getActionOptions({ eventData, drawId, structureId, structureName }) {
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
      onClick: () => navigateToEvent({ eventId, drawId }),
      label: 'View entries'
    },
    {
      onClick: () => deleteFlights({ eventData, drawIds: [drawId] }),
      label: 'Delete draw'
    }
  ];
}
