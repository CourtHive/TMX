/**
 * Render events tab with draw view, entries panels, or events table.
 * Handles routing to draw views, round tables, or entry management based on parameters.
 */
import { createEntriesPanels } from 'components/tables/eventsTable/createEntriesPanels';
import { createRoundsTable } from 'components/tables/roundsTable/createRoundsTable';
import { createBracketTable } from 'components/tables/bracketTable/createBracketTable';
import { createStatsTable } from 'components/tables/statsTable/createStatsTable';
import { setEventView } from 'components/tables/eventsTable/setEventView';
import { destroyTables } from 'pages/tournament/destroyTable';
import { renderDrawView } from './renderDraws/renderDrawView';
import { findAncestor } from 'services/dom/parentAndChild';
import { cleanupDrawPanel } from './cleanupDrawPanel';
import { renderDrawPanel } from './renderDrawPanel';
import { highlightTab } from 'navigation';
import { eventsView } from './eventsView';

import { tournamentEngine, drawDefinitionConstants } from 'tods-competition-factory';
import { EVENTS_TAB, ROUNDS_BRACKET, ROUNDS_COLUMNS, ROUNDS_STATS, ROUNDS_TABLE, TOURNAMENT_EVENTS } from 'constants/tmxConstants';
const { CONTAINER } = drawDefinitionConstants;

type RenderEventsTabParams = {
  eventId?: string;
  drawId?: string;
  structureId?: string;
  renderDraw?: boolean;
  roundsView?: string;
};

export function renderEventsTab(params: RenderEventsTabParams): void {
  let { eventId, drawId, structureId, renderDraw, roundsView } = params;

  // Resolve structureId from draw data when not provided; default to Grid view for round robin draws
  if (drawId) {
    const eventData = tournamentEngine.getEventData({ eventId })?.eventData;
    const drawData = eventData?.drawsData?.find((d: any) => d.drawId === drawId);
    if (!structureId) structureId = drawData?.structures?.[0]?.structureId;
    if (!roundsView) {
      const struct = drawData?.structures?.find((s: any) => s.structureId === structureId);
      roundsView = struct?.structureType === CONTAINER ? ROUNDS_BRACKET : ROUNDS_COLUMNS;
    }
  }
  highlightTab(EVENTS_TAB);
  destroyTables();
  cleanupDrawPanel();

  if (eventId || drawId) {
    const element = document.getElementById(TOURNAMENT_EVENTS);
    const headerElement = findAncestor(element, 'section')?.querySelector('.tabHeader') as HTMLElement;

    if (drawId && renderDraw) {
      const result = renderDrawPanel({ eventId: eventId!, drawId, headerElement });
      if (result.success) {
        if (roundsView === ROUNDS_TABLE) {
          (createRoundsTable as any)({ eventId: eventId!, drawId, structureId, roundsView });
        } else if (roundsView === ROUNDS_STATS) {
          (createStatsTable as any)({ eventId: eventId!, drawId, structureId, roundsView });
        } else if (roundsView === ROUNDS_BRACKET) {
          (createBracketTable as any)({ eventId: eventId!, drawId, structureId, roundsView });
        } else {
          (renderDrawView as any)({ eventId: eventId!, drawId, structureId, redraw: true, roundsView });
        }
        setEventView({ renderDraw });
      } else {
        (createEntriesPanels as any)({ eventId: eventId!, drawId });
        setEventView({ eventId });
      }
    } else {
      (createEntriesPanels as any)({ eventId, drawId, headerElement });
      setEventView({ eventId });
    }
  } else {
    eventsView();
    setEventView({ eventId });
  }
}
