import { tools, drawDefinitionConstants, tournamentEngine } from 'tods-competition-factory';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { editStructureNames } from 'components/modals/editStructureNames';
import { editGroupNames } from 'components/modals/editGroupNames';
import { addStructures } from 'components/modals/addStructures';
import { addDraw } from 'components/drawers/addDraw/addDraw';

const { FINISHING_POSITIONS, CONTAINER } = drawDefinitionConstants;

export function getStructureOptions({ drawData, eventId, structureId, updateControlBar }) {
  const drawId = drawData.drawId;
  const canAddPlayoffs = tournamentEngine.getAvailablePlayoffProfiles({ drawId, structureId })?.playoffRounds?.length;
  const canAddQualifying = tournamentEngine.isValidForQualifying({ drawId, structureId })?.valid;

  const addNewQualifying = () => {
    addDraw({
      callback: (result) => {
        if (result.success) {
          const structureId = result.structure.structureId;
          navigateToEvent({ eventId, drawId, structureId, renderDraw: true });
        }
      },
      drawName: 'Qualifying',
      isQualifying: true,
      structureId,
      eventId,
      drawId,
    });
  };

  const structure = drawData.structures.find((structure) => structure.structureId === structureId);
  const isRoundRobin = structure?.structureType === CONTAINER;

  return drawData.structures
    .sort((a, b) => tools.structureSort(a, b, { mode: FINISHING_POSITIONS }))
    .map((structure) => ({
      onClick: () => {
        navigateToEvent({ eventId, drawId, structureId: structure.structureId, renderDraw: true });
      },
      label: structure.structureName,
      close: true,
    }))
    .concat([
      { divider: true },
      {
        onClick: () => editStructureNames({ drawId, callback: () => updateControlBar(true) }),
        label: 'Edit structure names',
        modifyLabel: false,
        close: true,
      },
      {
        onClick: () => editGroupNames({ drawId, structure, callback: (res) => console.log(res) }),
        label: 'Edit group names',
        hide: !isRoundRobin,
        modifyLabel: false,
        close: true,
      },
      {
        onClick: () => addNewQualifying(),
        hide: !canAddQualifying,
        label: 'Add qualifying',
        modifyLabel: false,
        close: true,
      },
      {
        onClick: () => addStructures({ drawId, structureId, callback: () => updateControlBar(true) }),
        hide: !canAddPlayoffs,
        label: 'Add playoffs',
        modifyLabel: false,
        close: true,
      },
    ]);
}
