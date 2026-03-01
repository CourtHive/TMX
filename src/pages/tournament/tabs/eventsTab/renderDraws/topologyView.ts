/**
 * Topology View — Creates TopologyBuilderControl instance, mounts it.
 * onGenerate callback: topologyToDrawOptions() -> generateDraw() -> navigate to draw view.
 */
import { saveTopologyTemplate, getTopologyTemplates } from 'components/drawers/addDraw/topologyTemplates';
import { generateDraw } from 'components/drawers/addDraw/generateDraw';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { entryStatusConstants, tournamentEngine } from 'tods-competition-factory';
import { hydrateTopology } from './hydrateTopology';

import { ADD_PLAYOFF_STRUCTURES } from 'constants/mutationConstants';
import { DRAWS_VIEW } from 'constants/tmxConstants';

import { TopologyBuilderControl, topologyToDrawOptions } from 'courthive-components';
import type { TopologyState } from 'courthive-components';

let currentControl: TopologyBuilderControl | null = null;

export function renderTopologyView({
  eventId,
  drawId,
}: {
  eventId: string;
  drawId?: string;
  structureId?: string;
}): void {
  const drawsView = document.getElementById(DRAWS_VIEW);
  if (!drawsView) return;

  // Destroy existing
  destroyTopologyView();
  drawsView.innerHTML = '';

  // Try to hydrate from existing draw definition
  const event = tournamentEngine.getEvent({ eventId }).event;
  const drawDefinition = event?.drawDefinitions?.find((dd: any) => dd.drawId === drawId);
  const initialState = drawDefinition ? hydrateTopology(drawDefinition) : undefined;

  // Combine standard + saved templates
  const savedTemplates = getTopologyTemplates();

  currentControl = new TopologyBuilderControl({
    initialState,
    templates: savedTemplates,
    onGenerate: (state: TopologyState) => handleGenerate({ state, eventId, drawId }),
    onSaveTemplate: (state: TopologyState) => handleSaveTemplate({ state }),
  });

  currentControl.render(drawsView);
}

function handleGenerate({
  state,
  eventId,
  drawId,
}: {
  state: TopologyState;
  eventId: string;
  drawId?: string;
}): void {
  const { drawOptions, postGenerationMethods } = topologyToDrawOptions(state);
  drawOptions.eventId = eventId;
  if (drawId) drawOptions.drawId = drawId;

  const event = tournamentEngine.getEvent({ eventId }).event;
  if (!event) return;

  // Get draw entries
  const { DIRECT_ENTRY_STATUSES } = entryStatusConstants;
  const drawEntries = event.entries?.filter(
    ({ entryStage, entryStatus }: any) =>
      (!entryStage || entryStage === 'MAIN') && DIRECT_ENTRY_STATUSES.includes(entryStatus),
  ) || [];
  drawOptions.drawEntries = drawEntries;

  const postGeneration = (result: any) => {
    if (!result?.drawDefinition) {
      tmxToast({ message: 'Draw generation failed', intent: 'is-danger' });
      return;
    }

    const generatedDrawId = result.drawDefinition.drawId;
    const mainStructureId = result.drawDefinition.structures?.find(
      (s: any) => s.stage === 'MAIN',
    )?.structureId;

    // Handle post-generation methods (playoffs)
    if (postGenerationMethods.length > 0 && mainStructureId) {
      const methods = postGenerationMethods.map((pgm) => ({
        method: ADD_PLAYOFF_STRUCTURES,
        params: {
          ...pgm.params,
          drawId: generatedDrawId,
          structureId: mainStructureId,
        },
      }));

      mutationRequest({
        methods,
        callback: () => {
          tmxToast({ message: 'Draw generated successfully', intent: 'is-success' });
          navigateToEvent({
            eventId,
            drawId: generatedDrawId,
            structureId: mainStructureId,
            renderDraw: true,
          });
        },
      });
    } else {
      tmxToast({ message: 'Draw generated successfully', intent: 'is-success' });
      navigateToEvent({
        eventId,
        drawId: generatedDrawId,
        structureId: mainStructureId,
        renderDraw: true,
      });
    }
  };

  generateDraw({ drawOptions, eventId, callback: postGeneration });
}

function handleSaveTemplate({
  state,
}: {
  state: TopologyState;
}): void {
  const templateName = prompt('Template name:', state.drawName || 'My Template');
  if (!templateName) return;

  saveTopologyTemplate({
    state,
    name: templateName,
    description: `${state.nodes.length} structures, ${state.edges.length} links`,
  });
}

export function destroyTopologyView(): void {
  if (currentControl) {
    currentControl.destroy();
    currentControl = null;
  }
}
