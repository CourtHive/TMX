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
import {
  discardTopologyDraft,
  getTopologyDraft,
  hasTopologyDraft,
  keepTopologyDraft,
  topologyDraftKey,
} from './topologyDrafts';
import { designForFlight } from './topologyFlightDesign';
import { fillToViewportBottom } from 'functions/heightToViewportBottom';
import { defaultMatchUpFormat, defaultTopology, type DrawFormChoices } from './topologyDefaults';
import { scalesMap } from 'config/scalesConfig';
import { context } from 'services/context';
import { t } from 'i18n';
import {
  acceptanceEntries,
  composeEntryChanges,
  entryChangeMethods,
  qualifyingPathMethods,
  withEntryChanges,
  withQualifyingPaths,
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
import type { EntryChange, QualifyingPathAssignment } from 'components/drawers/addDraw/acceptanceEntries';
import { acceptedStatusSet } from 'constants/acceptedEntryStatuses';
import { getSeedingAllowance, INHERIT } from 'components/drawers/addDraw/seedingPolicies';
import { isSeedableDrawType } from 'components/drawers/addDraw/seedCount';

let currentControl: TopologyBuilderControl | null = null;
let pendingTemplateName: string | null = null;
/** The Add Draw drawer's choices, handed to the builder by its "Open in draw builder". */
let pendingFormChoices: DrawFormChoices | null = null;
/** The key of the new draw on the canvas (its event's, or its flight's): kept as its draft when the builder is left. */
let draftKey: string | null = null;
/**
 * The flight the canvas is building a draw for (CA, 2026-11-17): a flight is a reserved drawId with its own entries,
 * and the builder then works on those, not the event's — the defaults, the fit, the acceptance line, the ledger and
 * the draw generated.
 */
let flightDrawId: string | null = null;
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

  const { initialState, isNewDraw } = startingTopology({ eventId, drawId, readOnly });

  const savedTemplates = getTopologyTemplates();

  currentControl = new TopologyBuilderControl({
    initialState,
    templates: savedTemplates,
    hideTemplates: true,
    readOnly,
    footer: true,
    // a structure added on the canvas starts on the event's format, not "Not set" (CA, 2026-11-17)
    defaultMatchUpFormat: eventMatchUpFormat(eventId),
    // A draw being built (the event's, or a flight's) opens in Fit mode: how its entries would fill it, with levers
    // (CA, 2026-11-08). A made draw's entries are placed already, so it has no fit to ask for.
    ...(isNewDraw && {
      mode: 'fit' as const,
      drawFit: (
        state: TopologyState,
        trial?: { entryChanges: EntryChange[]; qualifyingPaths?: QualifyingPathAssignment[] },
      ) => drawFitFor({ state, eventId, entryChanges: trial?.entryChanges, qualifyingPaths: trial?.qualifyingPaths }),
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
 * What the canvas opens with, and whether it is a new draw (kept as a draft when the builder is left). A made draw is
 * hydrated from its definition; otherwise a template picked for it; otherwise, for a new draw (the event's, or a
 * flight's), what the Add Draw drawer handed over, else the canvas left for it, else the structures its accepted entries
 * already call for. Sets the canvas's draft key and flight.
 */
function startingTopology({ eventId, drawId, readOnly }: { eventId: string; drawId?: string; readOnly?: boolean }) {
  const drawDefinition = tournamentEngine.q
    .event({ eventId })
    ?.drawDefinitions?.find((dd: any) => dd.drawId === drawId);
  const flight = drawId && !drawDefinition ? eventFlight(eventId, drawId) : undefined;
  flightDrawId = flight?.drawId ?? null;

  let initialState: Partial<TopologyState> | undefined = drawDefinition ? hydrateTopology(drawDefinition) : undefined;
  const template = !initialState && pendingTemplateName ? findTopologyTemplate(pendingTemplateName) : undefined;
  if (template) {
    initialState = { ...template.state, selectedNodeId: null, selectedEdgeId: null, templateName: template.name };
  }
  pendingTemplateName = null;

  const isNewDraw = !drawDefinition && !readOnly && (!drawId || !!flight);
  const key = topologyDraftKey(eventId, flightDrawId);
  const handedOver = pendingFormChoices;
  pendingFormChoices = null;
  if (!initialState && isNewDraw) {
    // a flight's draw is named as the flight is
    const choices = handedOver ?? (flight ? { drawName: flight.drawName } : undefined);
    initialState =
      (handedOver ? undefined : getTopologyDraft(key)) ??
      defaultTopology(builderEvent(eventId), choices, eventMatchUpFormat(eventId));
  }
  draftKey = isNewDraw ? key : null;
  return { initialState, isNewDraw };
}

/** The format the event's new structures start on: its own, its competition format's, the tournament's, else SA. */
function eventMatchUpFormat(eventId: string): string {
  const event = tournamentEngine.getEvent({ eventId })?.event;
  return defaultMatchUpFormat(event, tournamentEngine.getTournament()?.tournamentRecord);
}

/**
 * The factory's fit for the draw a topology describes: the same draw options Generate makes (`topologyToDrawOptions`),
 * asked of `getDrawFit`, which runs the generator and attaches nothing.
 */
function drawFitFor({
  state,
  eventId,
  entryChanges,
  qualifyingPaths,
}: {
  state: TopologyState;
  eventId: string;
  /** the acceptance line's pending changes: the fit is asked about the entries as they would be */
  entryChanges?: EntryChange[];
  /** the paths the qualifying bands give their entries, as the builder asks with them */
  qualifyingPaths?: QualifyingPathAssignment[];
}): any {
  const event = builderEvent(eventId);
  if (!event) return undefined;
  const { drawOptions } = topologyToDrawOptions(state);
  // the entries as Generate will make them: the acceptance lines' changes, then the paths the qualifying bands give
  const drawEntries = withQualifyingPaths(
    withEntryChanges(topologyFitEntries({ event, state }), entryChanges),
    qualifyingPaths,
  );
  return tournamentEngine.getDrawFit({
    ...drawOptions,
    // the seeds Configure draw will place by default: MAIN's late entry counts them against its fed positions, and
    // the fit's seed BYEs are the draw's (CA, 2026-11-18). Unasked, the fit reads 0 seeds.
    seedsCount: fitSeedsCount({ eventId, drawOptions, drawEntries }),
    drawEntries,
    eventId,
  });
}

/** The default seed count Configure draw resolves for this MAIN, from the event's seeding policy. */
function fitSeedsCount({
  eventId,
  drawOptions,
  drawEntries,
}: {
  eventId: string;
  drawOptions: any;
  drawEntries: any[];
}) {
  if (!isSeedableDrawType(drawOptions.drawType)) return 0;
  const participantsCount = drawEntries.filter(
    (entry: any) => (entry.entryStage ?? MAIN) === MAIN && acceptedStatusSet.has(entry.entryStatus),
  ).length;
  return (
    getSeedingAllowance({ selectedSeedingPolicy: INHERIT, participantsCount, drawSize: drawOptions.drawSize, eventId })
      .thresholdSeedsCount ?? 0
  );
}

/** Ask the factory about trial entries; choosing an option remains a local preview. */
function fitProposalsFor(state: TopologyState, eventId: string, changes: EntryChange[]) {
  const event = builderEvent(eventId);
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

/** The entries for the acceptance line (the event's, or the flight's), in acceptance order. */
function rankedAcceptanceEntries(eventId: string) {
  const event = builderEvent(eventId);
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

  const event = builderEvent(eventId);
  if (!event) return;
  // as Generate was asked: the draw comes back after the server's round trip
  const flightId = flightDrawId;
  const isDraft = !!draftKey;

  // the acceptance line's pending changes: the draw is made from the entries as they will be, and the changes are
  // applied in the same request that adds it
  const entryChanges = currentControl?.getEntryChanges?.() ?? [];
  // the paths the qualifying bands give their entries (CA, 2026-11-18): written before the draw, and the draw is made
  // from the entries with them
  const pathAssignments = currentControl?.qualifyingPathAssignments?.() ?? [];
  const entries = withQualifyingPaths(withEntryChanges(event.entries ?? [], entryChanges), pathAssignments);
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
        if (isDraft) abandonTopologyDraft(eventId, flightId);
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
        // the stage moves first: a qualifying path is set only on a QUALIFYING entry
        entryMethods: [
          ...entryChangeMethods(eventId, entryChanges, flightId),
          ...qualifyingPathMethods(eventId, pathAssignments, flightId),
        ],
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
    if (draftKey) keepTopologyDraft(draftKey, currentControl.getState());
    currentControl.destroy();
    currentControl = null;
  }
  draftKey = null;
  flightDrawId = null;
}

/** Let a draft go (an event's, or with a flight's drawId that flight's): the canvas's is then not kept on leaving. */
export function abandonTopologyDraft(eventId: string, drawId?: string | null): void {
  const key = topologyDraftKey(eventId, drawId);
  if (draftKey === key) draftKey = null;
  discardTopologyDraft(key);
}

/** The event's other flights without a draw: those a flight's design can be given to. */
export function otherFlightsWithoutDraws(eventId: string, drawId?: string | null): any[] {
  const event = tournamentEngine.q.event({ eventId });
  const made = new Set((event?.drawDefinitions ?? []).map((dd: any) => dd.drawId));
  const flights = tournamentEngine.q.flightProfile({ eventId })?.flights ?? [];
  return flights.filter((flight: any) => flight.drawId !== drawId && !made.has(flight.drawId));
}

/**
 * Use this flight's design for the event's other flights (topology builder 3B, CA, 2026-11-18): each flight without a
 * draw gets the design as its builder draft, sized to its own entries. Nothing is generated; the director opens each
 * flight, checks its fit, and generates it, and each draw is independent once made. Drafts a flight already holds are
 * replaced only when the director confirms.
 */
export function useDesignForOtherFlights(eventId: string, onDone?: () => void): void {
  if (!currentControl || !flightDrawId) return;
  const others = otherFlightsWithoutDraws(eventId, flightDrawId);
  if (!others.length) return;
  const design = currentControl.getState();
  const apply = () => {
    for (const flight of others)
      keepTopologyDraft(topologyDraftKey(eventId, flight.drawId), designForFlight(design, flight));
    tmxToast({ message: t('topology.flightDraftsMade', { count: others.length }), intent: IS_SUCCESS });
    onDone?.();
  };
  const replacing = others.filter((flight: any) => hasTopologyDraft(topologyDraftKey(eventId, flight.drawId)));
  if (!replacing.length) return apply();
  confirmModal({
    title: t('topology.useForOtherFlights'),
    query: t('topology.replaceFlightDrafts', { count: replacing.length }),
    okIntent: 'is-warning',
    okAction: apply,
    cancelAction: undefined,
  });
}

/** The flight of the event with this drawId, while it has no draw. */
function eventFlight(eventId: string, drawId: string): any {
  const flightProfile = tournamentEngine.q.flightProfile({ eventId });
  return flightProfile?.flights?.find((flight: any) => flight.drawId === drawId);
}

/** The event as the builder works on it: with the flight's entries when the canvas is building a flight's draw. */
function builderEvent(eventId: string): any {
  const event = tournamentEngine.q.event({ eventId });
  const flight = event && flightDrawId ? eventFlight(eventId, flightDrawId) : undefined;
  return flight ? { ...event, entries: flight.drawEntries ?? [] } : event;
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
