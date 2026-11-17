/**
 * Topology Page — Standalone page for the topology builder.
 * Renders the topology builder in its own full-page container,
 * separate from the events tab.
 */
import { TopologyBuilderControl, topologyToDrawOptions, TopologyState, renderForm } from 'courthive-components';
import { openTopologyDrawSettings } from 'components/drawers/addDraw/topologyDrawSettingsDrawer';
import { applyTopologyDrawSettings } from 'components/drawers/addDraw/topologyDrawSettings';
import { confirmModal, openModal } from 'components/modals/baseModal/baseModal';
import { hydrateTopology } from './tabs/eventsTab/renderDraws/hydrateTopology';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { NONE, TMX_TOPOLOGY, TOURNAMENT } from 'constants/tmxConstants';
import { generateDraw } from 'components/drawers/addDraw/generateDraw';
import { drawDefinitionConstants } from 'tods-competition-factory';
import { removeAllChildNodes } from 'services/dom/transformers';
import { preferencesConfig } from 'config/preferencesConfig';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { discardTopologyDraft, getTopologyDraft, keepTopologyDraft } from './topologyDrafts';
import { fillToViewportBottom } from 'functions/heightToViewportBottom';
import { defaultTopology, type DrawFormChoices } from './topologyDefaults';
import { scalesMap } from 'config/scalesConfig';
import { context } from 'services/context';
import { t } from 'i18n';
import {
  acceptanceEntries,
  composeEntryChanges,
  entryChangeMethods,
  withEntryChanges,
} from 'components/drawers/addDraw/acceptanceEntries';
import {
  attachTopologyStructures,
  topologyDrawEntries,
  topologyFitEntries,
} from 'components/drawers/addDraw/topologyPostGeneration';
import {
  findTopologyTemplate,
  getTopologyTemplates,
  saveTopologyTemplate,
} from 'components/drawers/addDraw/topologyTemplates';

// constants and types
import type { EntryChange } from 'components/drawers/addDraw/acceptanceEntries';
import { acceptedStatusSet } from 'constants/acceptedEntryStatuses';

let currentControl: TopologyBuilderControl | null = null;
let pendingTemplateName: string | null = null;
/** The Add Draw drawer's choices, handed to the builder by its "Open in draw builder". */
let pendingFormChoices: DrawFormChoices | null = null;
/** The event whose new draw is on the canvas: kept as its draft when the builder is left. */
let draftEventId: string | null = null;
let releaseHeight: (() => void) | null = null;

/** Room under the builder for the page's own bottom margin, as the draw view's inline topology leaves. */
const BOTTOM_GAP = 8;

const IS_SUCCESS = 'is-success';
const { MAIN, QUALIFYING } = drawDefinitionConstants;
const ENTRY_STAGES = new Set<string>([MAIN, QUALIFYING]);

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

  // A new draw: what the Add Draw drawer handed over, else the canvas left for this event, else the structures its
  // accepted entries already call for
  const isNewDraw = !drawId && !readOnly;
  if (!initialState && isNewDraw && pendingFormChoices) initialState = defaultTopology(event, pendingFormChoices);
  pendingFormChoices = null;
  if (!initialState && isNewDraw) initialState = getTopologyDraft(eventId) ?? defaultTopology(event);
  draftEventId = isNewDraw ? eventId : null;

  const savedTemplates = getTopologyTemplates();

  currentControl = new TopologyBuilderControl({
    initialState,
    templates: savedTemplates,
    hideTemplates: true,
    readOnly,
    footer: true,
    // A draw being built opens in Fit mode: how the event's entries would fill it, with levers (CA, 2026-11-08). A
    // made draw's entries are placed already, so it has no fit to ask for.
    ...(!drawId &&
      !readOnly && {
        mode: 'fit' as const,
        drawFit: (state: TopologyState, trial?: { entryChanges: EntryChange[] }) =>
          drawFitFor({ state, eventId, entryChanges: trial?.entryChanges }),
        fitProposals: (state: TopologyState, trial: { entryChanges: EntryChange[] }) =>
          fitProposalsFor(state, eventId, trial.entryChanges),
        // Both stages use the active rating scale; Generate applies their changes together.
        acceptance: {
          entries: (stage) => rankedAcceptanceEntries(eventId).filter((entry) => entry.entryStage === stage),
        },
        sanctionLimits: () => tournamentEngine.getDrawCompositionConstraints({ eventId }),
      }),
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

  // The builder fills the window below the event's tabs, footer included, as the draw view's inline topology does
  const host = document.createElement('div');
  host.className = 'tmx-topology-host';
  container.appendChild(host);
  currentControl.render(host);
  releaseHeight = fillToViewportBottom(host, { gap: BOTTOM_GAP });

  // Auto-layout for hydrated or template-loaded topologies
  if (initialState) {
    currentControl.autoLayout();
  }
}

/**
 * The factory's fit for the draw a topology describes: the same draw options Generate makes (`topologyToDrawOptions`),
 * asked of `getDrawFit`, which runs the generator and attaches nothing.
 */
function drawFitFor({
  state,
  eventId,
  entryChanges,
}: {
  state: TopologyState;
  eventId: string;
  /** the acceptance line's pending changes: the fit is asked about the entries as they would be */
  entryChanges?: EntryChange[];
}): any {
  const event = tournamentEngine.q.event({ eventId });
  if (!event) return undefined;
  const { drawOptions } = topologyToDrawOptions(state);
  return tournamentEngine.getDrawFit({
    ...drawOptions,
    drawEntries: withEntryChanges(topologyFitEntries({ event, state }), entryChanges),
    eventId,
  });
}

/** Ask the factory about trial entries; choosing an option remains a local preview. */
function fitProposalsFor(state: TopologyState, eventId: string, changes: EntryChange[]) {
  const event = tournamentEngine.q.event({ eventId });
  if (!event) return { error: t('topology.eventNotFound') };
  const original = (event.entries ?? []).filter((entry) => ENTRY_STAGES.has(entry.entryStage ?? MAIN));
  const entries = withEntryChanges(original, changes);
  const { drawOptions } = topologyToDrawOptions(state);
  const result = tournamentEngine.getDrawFitProposals({
    ...drawOptions,
    eventId,
    drawEntries: entries,
    rankedEntries: withEntryChanges(rankedAcceptanceEntries(eventId), changes),
  });
  return {
    error: result.error,
    proposals: result.proposals?.map((proposal) => {
      const entryChanges = composeEntryChanges(
        original,
        changes,
        proposal.entryChanges.map((entry) => ({
          participantId: entry.participantId,
          from: '',
          to: entry.entryStatus,
          fromStage: entry.entryStage,
          toStage: entry.toStage,
        })),
      );
      return { ...proposal, entryChanges };
    }),
  };
}

/** The event's MAIN entries for the acceptance line, best first by the active rating scale. */
function rankedAcceptanceEntries(eventId: string) {
  const event = tournamentEngine.q.event({ eventId });
  if (!event) return [];
  const { participants = [] } =
    tournamentEngine.getParticipants({ withScaleValues: true, withIndividualParticipants: true }) ?? {};
  return acceptanceEntries({
    entries: event.entries ?? [],
    stage: 'ALL',
    participants,
    eventType: event.eventType,
    ratingScale: scalesMap[preferencesConfig.get().activeScale?.toLowerCase()],
  });
}

function handleGenerate({ state, eventId, drawId }: { state: TopologyState; eventId: string; drawId?: string }): void {
  // the builder disables Generate while the topology has errors; a conversion that still throws is reported, not raised
  let converted: ReturnType<typeof topologyToDrawOptions>;
  try {
    converted = topologyToDrawOptions(state);
  } catch (err: any) {
    tmxToast({ message: err?.message || t('topology.drawFailed'), intent: 'is-danger' });
    return;
  }
  const { drawOptions, postGenerationMethods } = converted;
  drawOptions.eventId = eventId;
  if (drawId) drawOptions.drawId = drawId;

  const event = tournamentEngine.q.event({ eventId });
  if (!event) return;

  // the acceptance line's pending changes: the draw is made from the entries as they will be, and the changes are
  // applied in the same request that adds it
  const entryChanges = currentControl?.getEntryChanges?.() ?? [];
  const entries = withEntryChanges(event.entries ?? [], entryChanges);
  drawOptions.drawEntries = topologyDrawEntries({ event: { ...event, entries }, state, includeAlternates: true });

  // the Add Draw drawer's settings the topology does not define: score format, seeding, creation (CA, 2026-11-17)
  const mainNode = state.nodes.find((node) => node.stage === MAIN);
  const main = {
    matchUpFormat: mainNode?.matchUpFormat,
    drawType: drawOptions.drawType,
    drawSize: drawOptions.drawSize,
    entriesCount: entries.filter(
      (entry: any) => (entry.entryStage ?? MAIN) === MAIN && acceptedStatusSet.has(entry.entryStatus),
    ).length,
  };

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
            message: t('topology.structuresNotAttached', { unattached: unresolved.join(', ') }),
            intent: 'is-warning',
          });
        } else {
          tmxToast({ message: t('topology.drawGenerated'), intent: IS_SUCCESS });
        }
        // the draft is the draw now
        if (!drawId) abandonTopologyDraft(eventId);
        navigateToEvent({ eventId, drawId: generatedDrawId, structureId: mainStructureId, renderDraw: true });
      },
    });
  };

  openTopologyDrawSettings({
    event,
    main,
    onSubmit: (settings) =>
      generateDraw({
        drawOptions: applyTopologyDrawSettings(drawOptions, settings),
        eventId,
        callback: postGeneration,
        entryMethods: entryChangeMethods(eventId, entryChanges),
      }),
  });
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
  releaseHeight?.();
  releaseHeight = null;
  if (currentControl) {
    if (draftEventId) keepTopologyDraft(draftEventId, currentControl.getState());
    currentControl.destroy();
    currentControl = null;
  }
  draftEventId = null;
}

/** Let an event's draft go: the one on the canvas is then not kept when the builder is left. */
export function abandonTopologyDraft(eventId: string): void {
  if (draftEventId === eventId) draftEventId = null;
  discardTopologyDraft(eventId);
}

export function navigateToTopology({
  eventId,
  drawId,
  readOnly,
  templateName,
  formChoices,
}: {
  eventId: string;
  drawId?: string;
  readOnly?: boolean;
  templateName?: string;
  formChoices?: DrawFormChoices;
}): void {
  pendingTemplateName = templateName || null;
  pendingFormChoices = formChoices ?? null;
  const tournamentId = tournamentEngine.q.tournament()?.tournamentId;
  let route = `/${TOURNAMENT}/${tournamentId}/topology/${eventId}`;
  if (drawId) route += `/${drawId}`;
  if (readOnly) route += '/view';
  context.router?.navigate(route);
}
