/**
 * Topology Page — Standalone page for the topology builder.
 * Renders the topology builder in its own full-page container,
 * separate from the events tab.
 */
import {
  findTopologyTemplate,
  getTopologyTemplates,
  saveTopologyTemplate,
} from 'components/drawers/addDraw/topologyTemplates';
import { attachTopologyStructures, topologyDrawEntries } from 'components/drawers/addDraw/topologyPostGeneration';
import { TopologyBuilderControl, topologyToDrawOptions, TopologyState, renderForm } from 'courthive-components';
import { confirmModal, openModal } from 'components/modals/baseModal/baseModal';
import { hydrateTopology } from './tabs/eventsTab/renderDraws/hydrateTopology';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { generateDraw } from 'components/drawers/addDraw/generateDraw';
import { drawDefinitionConstants } from 'tods-competition-factory';
import { showTopology } from 'services/transitions/screenSlaver';
import { removeAllChildNodes } from 'services/dom/transformers';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { context } from 'services/context';

// constants
import { NONE, TMX_TOPOLOGY, TOURNAMENT } from 'constants/tmxConstants';
import { t } from 'i18n';

let currentControl: TopologyBuilderControl | null = null;
let pendingTemplateName: string | null = null;

const IS_SUCCESS = 'is-success';
const { MAIN } = drawDefinitionConstants;

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
  const event = tournamentEngine.q.event({ eventId });
  const drawDefinition = event?.drawDefinitions?.find((dd: any) => dd.drawId === drawId);
  let initialState = drawDefinition ? hydrateTopology(drawDefinition) : undefined;

  // Load from pending template selection (from Draw Type dropdown)
  if (!initialState && pendingTemplateName) {
    const template = findTopologyTemplate(pendingTemplateName);

    if (template) {
      initialState = {
        ...template.state,
        selectedNodeId: null,
        selectedEdgeId: null,
        templateName: template.name,
      } as Partial<TopologyState>;
    }
  }
  pendingTemplateName = null;

  const savedTemplates = getTopologyTemplates();

  currentControl = new TopologyBuilderControl({
    initialState,
    templates: savedTemplates,
    hideTemplates: true,
    readOnly,
    onGenerate: readOnly ? undefined : (state: TopologyState) => handleGenerate({ state, eventId, drawId }),
    onSaveTemplate: readOnly ? undefined : (state: TopologyState) => handleSaveTemplate({ state }),
    onDoubleClickNode: readOnly
      ? (node) => navigateToEvent({ eventId, drawId, structureId: node.id, renderDraw: true })
      : undefined,
    onClear: readOnly
      ? undefined
      : () => {
          confirmModal({
            title: t('topology.clearCanvas'),
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

  // Auto-layout for hydrated or template-loaded topologies
  if (initialState) {
    currentControl.autoLayout();
  }
}

function handleGenerate({ state, eventId, drawId }: { state: TopologyState; eventId: string; drawId?: string }): void {
  const { drawOptions, postGenerationMethods } = topologyToDrawOptions(state);
  drawOptions.eventId = eventId;
  if (drawId) drawOptions.drawId = drawId;

  const event = tournamentEngine.q.event({ eventId });
  if (!event) return;

  drawOptions.drawEntries = topologyDrawEntries({ event, state });

  const postGeneration = (result: any) => {
    if (!result?.drawDefinition) {
      tmxToast({ message: t('topology.drawFailed'), intent: 'is-danger' });
      return;
    }

    const generatedDrawId = result.drawDefinition.drawId;
    const mainStructureId = result.drawDefinition.structures?.find((s: any) => s.stage === MAIN)?.structureId;

    attachTopologyStructures({
      drawDefinition: result.drawDefinition,
      postGenerationMethods,
      onDone: ({ unresolved }) => {
        if (unresolved.length) {
          tmxToast({
            message: t('topology.structuresNotAttached', { names: unresolved.join(', ') }),
            intent: 'is-warning',
          });
        } else {
          tmxToast({ message: t('topology.drawGenerated'), intent: IS_SUCCESS });
        }
        navigateToEvent({ eventId, drawId: generatedDrawId, structureId: mainStructureId, renderDraw: true });
      },
    });
  };

  generateDraw({ drawOptions, eventId, callback: postGeneration });
}

function handleSaveTemplate({ state }: { state: TopologyState }): void {
  const content = document.createElement('div');
  const inputs = renderForm(content, [
    {
      label: t('topology.templateName'),
      field: 'templateName',
      value: state.drawName || 'My Template',
      focus: true,
    },
  ]);

  openModal({
    title: t('templates.saveTemplate'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: NONE, close: true },
      {
        label: t('common.save'),
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
          tmxToast({ message: t('topology.templateSaved'), intent: IS_SUCCESS });
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
  templateName,
}: {
  eventId: string;
  drawId?: string;
  readOnly?: boolean;
  templateName?: string;
}): void {
  pendingTemplateName = templateName || null;
  const tournamentId = tournamentEngine.q.tournament()?.tournamentId;
  let route = `/${TOURNAMENT}/${tournamentId}/topology/${eventId}`;
  if (drawId) route += `/${drawId}`;
  if (readOnly) route += '/view';
  context.router?.navigate(route);
}
