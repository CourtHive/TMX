/**
 * Inline topology rendering within the draw view area.
 * Replaces the draw and draw control bar with a read-only topology view.
 *
 * ── The Add playoffs mode (CA, 2026-11-08) ──
 *
 * The topology's toolbar offers it: every structure that can still feed a playoff shows a chip per range, and a chip
 * attaches that one playoff through the same path as the Add playoffs dialog (`attachGeneratedPlayoffs`). The offers
 * are the LIVE draw's — `getAvailablePlayoffProfiles` without a structureId answers every structure at once — read
 * once per draw state and again after each attach; the topology is then loaded again from the draw.
 */
import { hydrateTopology } from 'pages/tournament/tabs/eventsTab/renderDraws/hydrateTopology';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { attachGeneratedPlayoffs } from 'components/modals/addStructures';
import { tmxToast } from 'services/notifications/tmxToast';
import { removeAllChildNodes } from 'services/dom/transformers';
import { getTopologyControlItems } from './eventControlItems';
import { tournamentEngine } from 'services/factory/engine';
import {
  playoffGenerationParams,
  playoffOffersByStructure,
  TopologyBuilderControl,
  controlBar,
} from 'courthive-components';

import { DRAW_CONTROL, DRAWS_VIEW, EVENT_CONTROL, PLAYOFF_NAME_BASE } from 'constants/tmxConstants';
import type { PlayoffOffer, TopologyNode } from 'courthive-components';

let inlineControl: TopologyBuilderControl | null = null;

export function renderInlineTopology({
  eventId,
  drawId,
  structureId,
}: {
  eventId: string;
  drawId: string;
  structureId: string;
}): void {
  const drawsView = document.getElementById(DRAWS_VIEW);
  const drawControl = document.getElementById(DRAW_CONTROL);
  if (!drawsView) return;

  // Destroy any previous inline topology
  destroyInlineTopology();

  // Hide the draw control bar
  if (drawControl) drawControl.style.display = 'none';

  // Clear draw view and render topology into it
  removeAllChildNodes(drawsView);
  drawsView.style.display = '';

  // Hydrate topology from draw definition
  const drawDefinitionNow = () =>
    tournamentEngine.q.event({ eventId })?.drawDefinitions?.find((dd: any) => dd.drawId === drawId);
  const drawDefinition = drawDefinitionNow();
  const initialState = drawDefinition ? hydrateTopology(drawDefinition) : undefined;

  // Asked on every render, so read once and again only after this view changes the draw
  let offers = new Map<string, PlayoffOffer[]>();
  const readOffers = () => {
    offers = playoffOffersByStructure(
      tournamentEngine.getAvailablePlayoffProfiles({ drawId })?.availablePlayoffProfiles,
    );
  };
  readOffers();

  const addPlayoff = (node: TopologyNode, offer: PlayoffOffer) => {
    const genResult = tournamentEngine.generateAndPopulatePlayoffStructures({
      drawId,
      structureId: node.id,
      // a name and no abbreviation, as the dialog sends; the factory's NamingEntry type requires one its reader does not
      ...(playoffGenerationParams(offer, `${PLAYOFF_NAME_BASE} ${offer.finishingPositionRange}`) as any),
    });
    if (genResult.error) {
      tmxToast({ message: genResult.error?.message || 'Generation error', intent: 'is-danger' });
      return;
    }
    attachGeneratedPlayoffs({
      drawId,
      genResult,
      callback: () => {
        const updated = drawDefinitionNow();
        if (!inlineControl || !updated) return;
        readOffers();
        inlineControl.loadState(hydrateTopology(updated) as any);
        inlineControl.autoLayout();
      },
    });
  };

  inlineControl = new TopologyBuilderControl({
    initialState,
    hideTemplates: true,
    readOnly: true,
    playoffOffers: (node) => offers.get(node.id),
    onAddPlayoff: addPlayoff,
    onDoubleClickNode: (node) => {
      destroyInlineTopology();
      navigateToEvent({ eventId, drawId, structureId: node.id, renderDraw: true });
    },
  });

  inlineControl.render(drawsView);

  if (initialState) {
    inlineControl.autoLayout();
  }

  // Swap event control bar to topology mode
  const eventData = tournamentEngine.q.eventData({ eventId });
  const items = getTopologyControlItems({ structureId, eventData, eventId, drawId });
  const eventControlElement = document.getElementById(EVENT_CONTROL) || undefined;
  controlBar({ target: eventControlElement, items });
}

export function destroyInlineTopology(): void {
  if (inlineControl) {
    inlineControl.destroy();
    inlineControl = null;
  }

  // Restore draw control bar visibility
  const drawControl = document.getElementById(DRAW_CONTROL);
  if (drawControl) drawControl.style.display = '';
}
