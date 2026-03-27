/**
 * Get structure options menu for draw navigation.
 * Provides options to navigate structures, edit names, and add qualifying/playoffs/consolation.
 */
import { tools, drawDefinitionConstants, tournamentEngine } from 'tods-competition-factory';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { editStructureNames } from 'components/modals/editStructureNames';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { editGroupNames } from 'components/modals/editGroupNames';
import { addStructures } from 'components/modals/addStructures';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { renderDrawView } from './renderDrawView';

import { ATTACH_CONSOLATION_STRUCTURES, REMOVE_STAGE_ENTRIES } from 'constants/mutationConstants';

const { FINISHING_POSITIONS, CONTAINER, MAIN, AD_HOC, VOLUNTARY_CONSOLATION } = drawDefinitionConstants;

export function getStructureOptions({
  drawData,
  eventId,
  structureId,
}: {
  drawData: any;
  eventId: string;
  structureId: string;
}): any[] {
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
  const canAddQualifying = (() => {
    if (!tournamentEngine.isValidForQualifying({ drawId, structureId })?.valid) return false;
    // Hide when all positions are already filled (participants or byes)
    const { drawDefinition } = tournamentEngine.getEvent({ drawId });
    const mainStructure = drawDefinition?.structures?.find((s: any) => s.structureId === structureId);
    const positions = mainStructure?.positionAssignments || [];
    return positions.some((p: any) => !p.participantId && !p.bye);
  })();

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

  // Consolation can be added for elimination draws (SE, Lucky) — not AD_HOC or RR
  const isMainStructure = structure?.stage === MAIN && structure?.stageSequence === 1;
  const isAdHocDraw = drawData.drawType === AD_HOC;
  const hasConsolation = drawData.structures.some((s: any) => s.stage === VOLUNTARY_CONSOLATION);
  const canAddConsolation = isMainStructure && !isRoundRobin && !isAdHocDraw && !hasConsolation;

  return drawData.structures
    .sort((a: any, b: any) => tools.structureSort(a, b, { mode: FINISHING_POSITIONS }))
    .map((structure: any) => ({
      onClick: () => {
        renderDrawView({ eventId, drawId, structureId: structure.structureId, redraw: true });
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
        onClick: () => {
          // First purge any leftover VC entries, then create empty structure
          const purgeAndCreate = () => {
            const genResult = tournamentEngine.generateVoluntaryConsolation({
              structureName: 'Consolation',
              attachConsolation: false,
              drawId,
            });
            if (genResult.error || !genResult.structures?.length) {
              console.error('[addVC] generateVoluntaryConsolation failed:', genResult.error || 'no structures');
              return;
            }
            const vcStructureId = genResult.structures[0].structureId;
            mutationRequest({
              methods: [
                {
                  method: ATTACH_CONSOLATION_STRUCTURES,
                  params: { structures: genResult.structures, links: genResult.links, drawId },
                },
              ],
              callback: (result: any) => {
                if (result.success) {
                  navigateToEvent({ eventId, drawId, structureId: vcStructureId, renderDraw: true });
                }
              },
            });
          };

          // Check for leftover VC entries and remove them first
          const { drawDefinition: dd } = tournamentEngine.getEvent({ drawId });
          const hasVcEntries = dd?.entries?.some((e: any) => e.entryStage === VOLUNTARY_CONSOLATION);
          if (hasVcEntries) {
            mutationRequest({
              methods: [{ method: REMOVE_STAGE_ENTRIES, params: { drawId, entryStage: VOLUNTARY_CONSOLATION } }],
              callback: (result: any) => {
                if (result.success) purgeAndCreate();
              },
            });
          } else {
            purgeAndCreate();
          }
        },
        hide: !canAddConsolation,
        label: 'Add voluntary consolation',
        modifyLabel: false,
        close: true,
      },
    ]);
}
