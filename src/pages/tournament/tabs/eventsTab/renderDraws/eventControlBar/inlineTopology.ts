/**
 * Inline topology rendering within the draw view area.
 * Replaces the draw and draw control bar with a read-only topology view.
 */
import { TopologyBuilderControl, controlBar } from 'courthive-components';
import { tournamentEngine } from 'tods-competition-factory';
import { hydrateTopology } from 'pages/tournament/tabs/eventsTab/renderDraws/hydrateTopology';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { removeAllChildNodes } from 'services/dom/transformers';
import { getTopologyControlItems } from './eventControlItems';

import { DRAW_CONTROL, DRAWS_VIEW, EVENT_CONTROL } from 'constants/tmxConstants';

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
  const event = tournamentEngine.getEvent({ eventId }).event;
  const drawDefinition = event?.drawDefinitions?.find((dd: any) => dd.drawId === drawId);
  const initialState = drawDefinition ? hydrateTopology(drawDefinition) : undefined;

  inlineControl = new TopologyBuilderControl({
    initialState,
    hideTemplates: true,
    readOnly: true,
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
  const eventData = tournamentEngine.getEventData({ eventId }).eventData;
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
