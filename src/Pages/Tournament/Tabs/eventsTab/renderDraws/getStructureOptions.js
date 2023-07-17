import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { addStructures } from './addStructures';

export function getStructureOptions({ drawData, eventId, structureId, updateControlBar }) {
  const drawId = drawData.drawId;

  return drawData.structures
    .map((structure) => ({
      onClick: () => {
        navigateToEvent({ eventId, drawId, structureId: structure.structureId, renderDraw: true });
      },
      label: structure.structureName,
      close: true
    }))
    .concat([
      { divider: true },
      {
        onClick: () => console.log('edit structure names'),
        label: 'Edit structure names',
        modifyLabel: false,
        close: true
      },
      {
        onClick: () => addStructures({ drawId, structureId, callback: () => updateControlBar(true) }),
        label: 'Add playoffs',
        modifyLabel: false,
        close: true
      }
    ]);
}
