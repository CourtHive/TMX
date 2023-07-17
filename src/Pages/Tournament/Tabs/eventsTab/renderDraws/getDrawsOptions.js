import { selectAndDeleteEventFlights } from 'components/modals/selectAndDeleteFlights';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { addDraw } from 'components/drawers/addDraw/addDraw';

export function getDrawsOptions({ eventData }) {
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
    .concat([{ divider: true }, deleteOption, { label: 'Add flight', onClick: addFlight }])
    .filter(Boolean);
}
