import { createEntriesPanels } from 'components/tables/eventsTable/createEntriesPanels';
import { createRoundsTable } from 'components/tables/roundsTable/createRoundsTable';
import { createStatsTable } from 'components/tables/statsTable/createStatsTable';
import { setEventView } from 'components/tables/eventsTable/setEventView';
import { destroyTables } from 'pages/tournament/destroyTable';
import { renderDrawView } from './renderDraws/renderDrawView';
import { findAncestor } from 'services/dom/parentAndChild';
import { cleanupDrawPanel } from './cleanupDrawPanel';
import { renderDrawPanel } from './renderDrawPanel';
import { highlightTab } from 'navigation';
import { eventsView } from './eventsView';

import { EVENTS_TAB, ROUNDS_STATS, ROUNDS_TABLE, TOURNAMENT_EVENTS } from 'constants/tmxConstants';

export function renderEventsTab(params) {
  const { eventId, drawId, structureId, renderDraw, roundsView = 'roundsColumns' } = params;
  highlightTab(EVENTS_TAB);
  destroyTables();
  cleanupDrawPanel();

  if (eventId || drawId) {
    const element = document.getElementById(TOURNAMENT_EVENTS);
    const headerElement = findAncestor(element, 'section')?.querySelector('.tabHeader');

    if (drawId && renderDraw) {
      const result = renderDrawPanel({ eventId, drawId, headerElement });
      if (result.success) {
        if (roundsView === ROUNDS_TABLE) {
          createRoundsTable({ eventId, drawId, structureId, roundsView });
        } else if (roundsView === ROUNDS_STATS) {
          createStatsTable({ eventId, drawId, structureId, roundsView });
        } else {
          renderDrawView({ eventId, drawId, structureId, redraw: true, roundsView });
        }
        setEventView({ renderDraw });
      } else {
        // if draw cannot be rendered, fall back to view of entries
        createEntriesPanels({ eventId, drawId });
        setEventView({ eventId });
      }
    } else {
      createEntriesPanels({ eventId, drawId, headerElement });
      setEventView({ eventId });
    }
  } else {
    eventsView();
    setEventView({ eventId });
  }
}
