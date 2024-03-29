import { selectAndDeleteEventFlights } from 'components/modals/selectAndDeleteFlights';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { addDraw } from 'components/drawers/addDraw/addDraw';

export function getDrawsOptions({ eventData, drawId }) {
  const addFlight = () => {
    const callback = (result) => {
      if (result.drawDefinition) {
        const structureId = result.drawDefinition.structures?.[0]?.structureId;
        const eventId = eventData.eventInfo.eventId;
        const drawId = result.drawDefinition.drawId;
        navigateToEvent({ eventId, drawId, structureId, renderDraw: true });
      }
    };
    addDraw({ eventId: eventData.eventInfo.eventId, callback });
  };

  const deleteFlights = () => selectAndDeleteEventFlights({ eventData });

  const deleteOption = eventData.drawsData.length > 1 && {
    onClick: deleteFlights,
    label: 'Delete flights',
    modifyLabel: false,
    close: true
  };

  const viewEntries = eventData.drawsData.length && {
    onClick: () => navigateToEvent({ eventId: eventData.eventInfo.eventId, drawId }),
    label: 'View entries',
    modifyLabel: false,
    close: true
  };

  return eventData.drawsData
    .map((draw) => ({
      onClick: () => {
        const structureId = draw.structures?.[0]?.structureId;
        const eventId = eventData.eventInfo.eventId;
        const drawId = draw.drawId;

        navigateToEvent({ eventId, drawId, structureId, renderDraw: true });
      },
      label: draw.drawName,
      close: true
    }))
    .concat([
      { divider: true },
      viewEntries,
      deleteOption,
      { label: 'Add flight', modifyLabel: false, onClick: addFlight }
    ])
    .filter(Boolean);
}
