/**
 * Get structure options menu for draw navigation.
 * Provides options to navigate structures, edit names, and add qualifying/playoffs/consolation.
 */
import { tools, drawDefinitionConstants, tournamentEngine } from 'tods-competition-factory';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { editStructureNames } from 'components/modals/editStructureNames';
import { addConsolation } from 'components/modals/addConsolation';
import { editGroupNames } from 'components/modals/editGroupNames';
import { addStructures } from 'components/modals/addStructures';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { renderDrawView } from './renderDrawView';

const { FINISHING_POSITIONS, CONTAINER, MAIN, VOLUNTARY_CONSOLATION } = drawDefinitionConstants;

export function getStructureOptions({ drawData, eventId, structureId }: { drawData: any; eventId: string; structureId: string }): any[] {
  if (!drawData) return [];
  const drawId = drawData.drawId;

  // Refresh draw view after structural changes (rename, add playoffs, etc.).
  // Uses eventId/drawId/structureId from this closure to avoid undefined eventId issues.
  // renderDrawView uses morphdom — only changed DOM elements update.
  const refreshAfterStructuralChange = () => {
    renderDrawView({ eventId, drawId, structureId });
  };
  const profiles = tournamentEngine.getAvailablePlayoffProfiles({ drawId, structureId });
  const canAddPlayoffs = profiles?.playoffRounds?.length || profiles?.playoffFinishingPositionRanges?.length;
  const canAddQualifying = tournamentEngine.isValidForQualifying({ drawId, structureId })?.valid;

  const addNewQualifying = () => {
    addDraw({
      callback: (result: any) => {
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

  const structure = drawData.structures.find((structure: any) => structure.structureId === structureId);
  const isRoundRobin = structure?.structureType === CONTAINER;

  // Consolation can be added when the current structure is a MAIN elimination draw
  // and no VOLUNTARY_CONSOLATION structure already exists with matchUps
  const isMainStructure = structure?.stage === MAIN && structure?.stageSequence === 1;
  const hasConsolation = drawData.structures.some(
    (s: any) => s.stage === VOLUNTARY_CONSOLATION && s.matchUps?.length,
  );
  const canAddConsolation = isMainStructure && !isRoundRobin && !hasConsolation;

  return drawData.structures
    .sort((a: any, b: any) => tools.structureSort(a, b, { mode: FINISHING_POSITIONS }))
    .map((structure: any) => ({
      onClick: () => {
        navigateToEvent({ eventId, drawId, structureId: structure.structureId, renderDraw: true });
      },
      label: structure.structureName || structure.stage || 'Structure',
      close: true,
    }))
    .concat([
      { divider: true },
      {
        onClick: () => editStructureNames({ drawId, callback: refreshAfterStructuralChange }),
        label: 'Edit structure names',
        modifyLabel: false,
        close: true,
      },
      {
        onClick: () => editGroupNames({ drawId, structure, callback: refreshAfterStructuralChange }),
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
        onClick: () => (addStructures as any)({ drawId, structureId, callback: refreshAfterStructuralChange }),
        hide: !canAddPlayoffs,
        label: 'Add playoffs',
        modifyLabel: false,
        close: true,
      },
      {
        onClick: () => (addConsolation as any)({ drawId, callback: refreshAfterStructuralChange }),
        hide: !canAddConsolation,
        label: 'Add voluntary consolation',
        modifyLabel: false,
        close: true,
      },
    ]);
}
