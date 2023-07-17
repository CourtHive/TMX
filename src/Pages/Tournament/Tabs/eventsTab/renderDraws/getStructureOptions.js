import { utilities, drawDefinitionConstants } from 'tods-competition-factory';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { editStructureNames } from './editStructureNames';
import { addStructures } from './addStructures';

const { FINISHING_POSITIONS } = drawDefinitionConstants;

export function getStructureOptions({ drawData, eventId, structureId, updateControlBar }) {
  const drawId = drawData.drawId;

  return drawData.structures
    .sort((a, b) => utilities.structureSort(a, b, { mode: FINISHING_POSITIONS }))
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
        onClick: () => editStructureNames({ drawId, callback: () => updateControlBar(true) }),
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
