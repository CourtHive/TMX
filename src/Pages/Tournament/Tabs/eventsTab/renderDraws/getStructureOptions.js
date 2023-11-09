import { utilities, drawDefinitionConstants, tournamentEngine } from 'tods-competition-factory';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { editStructureNames } from './editStructureNames';
import { addStructures } from './addStructures';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { isFunction } from 'functions/typeOf';

const { FINISHING_POSITIONS, MAIN, QUALIFYING } = drawDefinitionConstants;

export function getStructureOptions({ drawData, eventId, structureId, updateControlBar }) {
  const drawId = drawData.drawId;
  const structure = drawData.structures.find((structure) => structure.structureId === structureId);
  const canAddQualifying = structure.stage == QUALIFYING || (structure.stage === MAIN && structure.stageSequence === 1);
  const foo = tournamentEngine.isValidForQualifying({ drawId, structureId });
  console.log({ canAddQualifying, foo });

  const addNewQualifying = ({ callback }) => {
    addDraw({
      callback: (result) => {
        console.log({ result });
        if (isFunction(callback)) callback();
        // const structureId = result.drawDefinition?.structures?.find(({ stage }) => stage === QUALIFYING)?.structureId;
        // navigateToEvent({ eventId, drawId, structureId, renderDraw: true });
      },
      drawName: 'Qualifying',
      isQualifying: true,
      structureId,
      eventId,
      drawId
    });
  };

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
        onClick: () => addNewQualifying({ callback: () => updateControlBar(true) }),
        hide: !canAddQualifying,
        label: 'Add qualifying',
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
