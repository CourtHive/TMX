/**
 * Get structure options menu for draw navigation.
 * Provides options to navigate structures, edit names, and add qualifying/playoffs/consolation.
 */
import { addVoluntaryConsolation } from 'components/modals/addVoluntaryConsolation';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { tools, drawDefinitionConstants } from 'tods-competition-factory';
import { editStructureNames } from 'components/modals/editStructureNames';
import { editGroupNames } from 'components/modals/editGroupNames';
import { canAddVoluntaryConsolation } from 'courthive-components';
import { addStructures } from 'components/modals/addStructures';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { defaultRoundsView } from '../options/roundsViews';
import { tournamentEngine } from 'services/factory/engine';
import { renderDrawView } from './renderDrawView';

// Constants
import { escapeHtml } from 'utilities/escapeHtml';
import { t } from 'i18n';

const { FINISHING_POSITIONS, CONTAINER } = drawDefinitionConstants;

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
  // The rounds this structure can be fed in, what already feeds each, and how much room is left.
  // Offered while some round has an open position a new qualifier could take (CA, 2026-10-07:
  // several qualifying structures may feed one round; 2026-10-09: a filled position is not room).
  const qualifyingTargetsResult = tournamentEngine.getAvailableQualifyingTargets({ drawId, structureId });
  const qualifyingTargets = qualifyingTargetsResult?.targets ?? [];
  const canAddQualifying =
    !!qualifyingTargetsResult?.valid && qualifyingTargets.some((target: any) => target.remainingCapacity > 0);

  const addNewQualifying = () => {
    addDraw({
      qualifyingTargets,
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

  // A voluntary consolation for elimination draws (SE, Lucky) — not AD_HOC or RR, one per draw. The rule lives in
  // courthive-components so this menu and the topology's Add playoffs chip ask the same question.
  const canAddConsolation = canAddVoluntaryConsolation(tournamentEngine.q.drawDefinition({ drawId }), structureId);

  return drawData.structures
    .toSorted((a: any, b: any) => tools.structureSort(a, b, { mode: FINISHING_POSITIONS }))
    .map((structure: any) => {
      const name = structure.structureName || structure.stage || 'Structure';
      return {
        onClick: () => {
          const roundsView = defaultRoundsView(structure);
          renderDrawView({ eventId, drawId, structureId: structure.structureId, redraw: true, roundsView });
        },
        label: escapeHtml(name),
        close: true,
      };
    })
    .concat([
      { divider: true },
      {
        onClick: () => editStructureNames({ drawId, callback: refreshAfterStructuralChange }),
        label: t('modals.editStructureNames.title'),
        modifyLabel: false,
        close: true,
      },
      {
        onClick: () => editGroupNames({ drawId, structure, callback: refreshAfterStructuralChange }),
        label: t('modals.editGroupNames.title'),
        hide: !isRoundRobin,
        modifyLabel: false,
        close: true,
      },
      {
        onClick: () => addNewQualifying(),
        hide: !canAddQualifying,
        label: t('drawActions.addQualifying'),
        modifyLabel: false,
        close: true,
      },
      {
        onClick: () => (addStructures as any)({ drawId, structureId, callback: refreshAfterStructuralChange }),
        hide: !canAddPlayoffs,
        label: t('drawActions.addPlayoffs'),
        modifyLabel: false,
        close: true,
      },
      {
        onClick: () =>
          addVoluntaryConsolation({
            drawId,
            callback: (vcStructureId) =>
              navigateToEvent({ eventId, drawId, structureId: vcStructureId, renderDraw: true }),
          }),
        hide: !canAddConsolation,
        label: t('modals.addConsolation.title'),
        modifyLabel: false,
        close: true,
      },
    ]);
}
