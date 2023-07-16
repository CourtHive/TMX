import { navigateToEvent } from 'components/tables/common/navigateToEvent';

export function getDrawsOptions({ eventData }) {
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
    .concat([{ divider: true }, { heading: 'Add flight', onClick: () => console.log('Add new flight') }]);
}
