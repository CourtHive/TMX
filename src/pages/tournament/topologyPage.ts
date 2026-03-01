/**
 * Topology Page — Standalone page for the topology builder.
 * Renders the topology builder in its own full-page container,
 * separate from the events tab.
 */
import { saveTopologyTemplate, getTopologyTemplates } from 'components/drawers/addDraw/topologyTemplates';
import { generateDraw } from 'components/drawers/addDraw/generateDraw';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { confirmModal, openModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { removeAllChildNodes } from 'services/dom/transformers';
import { showTopology } from 'services/transitions/screenSlaver';
import { tmxToast } from 'services/notifications/tmxToast';
import { entryStatusConstants, tournamentEngine } from 'tods-competition-factory';
import { hydrateTopology } from './tabs/eventsTab/renderDraws/hydrateTopology';
import { context } from 'services/context';

import { ADD_PLAYOFF_STRUCTURES } from 'constants/mutationConstants';
import { NONE, TMX_TOPOLOGY, TOURNAMENT } from 'constants/tmxConstants';

import { TopologyBuilderControl, topologyToDrawOptions, renderForm } from 'courthive-components';
import type { TopologyState } from 'courthive-components';

let currentControl: TopologyBuilderControl | null = null;

export function renderTopologyPage({
  eventId,
  drawId,
  readOnly,
}: {
  eventId: string;
  drawId?: string;
  readOnly?: boolean;
}): void {
  const container = document.getElementById(TMX_TOPOLOGY);
  if (!container) return;

  destroyTopologyPage();
  removeAllChildNodes(container);
  showTopology();

  // Hydrate from existing draw if drawId provided
  const event = tournamentEngine.getEvent({ eventId }).event;
  const drawDefinition = event?.drawDefinitions?.find((dd: any) => dd.drawId === drawId);
  const initialState = drawDefinition ? hydrateTopology(drawDefinition) : undefined;

  const savedTemplates = getTopologyTemplates();

  currentControl = new TopologyBuilderControl({
    initialState,
    templates: savedTemplates,
    hideTemplates: true,
    readOnly,
    onGenerate: readOnly ? undefined : (state: TopologyState) => handleGenerate({ state, eventId, drawId }),
    onSaveTemplate: readOnly ? undefined : (state: TopologyState) => handleSaveTemplate({ state }),
    onClear: readOnly ? undefined : () => {
      confirmModal({
        title: 'Clear Canvas',
        query: 'This will remove all structures and links. Continue?',
        okIntent: 'is-danger',
        cancelAction: undefined,
        okAction: () => {
          currentControl?.loadState({
            nodes: [],
            edges: [],
            selectedNodeId: null,
            selectedEdgeId: null,
            drawName: '',
          });
        },
      });
    },
  });

  currentControl.render(container);

  // Auto-layout when viewing an existing draw for a clean presentation
  if (initialState) {
    currentControl.autoLayout();
  }
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

function handleSaveTemplate({ state }: { state: TopologyState }): void {
  const content = document.createElement('div');
  const inputs = renderForm(content, [
    {
      label: 'Template Name',
      field: 'templateName',
      value: state.drawName || 'My Template',
      focus: true,
    },
  ]);

  openModal({
    title: 'Save Template',
    content,
    buttons: [
      { label: 'Cancel', intent: NONE, close: true },
      {
        label: 'Save',
        intent: 'is-info',
        close: true,
        onClick: () => {
          const name = inputs.templateName?.value?.trim();
          if (!name) return;
          saveTopologyTemplate({
            state,
            name,
            description: `${state.nodes.length} structures, ${state.edges.length} links`,
          });
          tmxToast({ message: 'Template saved', intent: 'is-success' });
        },
      },
    ],
  });
}

export function destroyTopologyPage(): void {
  if (currentControl) {
    currentControl.destroy();
    currentControl = null;
  }
}

export function navigateToTopology({
  eventId,
  drawId,
  readOnly,
}: {
  eventId: string;
  drawId?: string;
  readOnly?: boolean;
}): void {
  const tournamentId = tournamentEngine.getTournament()?.tournamentRecord?.tournamentId;
  let route = `/${TOURNAMENT}/${tournamentId}/topology/${eventId}`;
  if (drawId) route += `/${drawId}`;
  if (readOnly) route += '/view';
  context.router?.navigate(route);
}
