import { createEntriesPanels } from 'components/tables/eventsTable/createEntriesPanels';
import { setEventView } from 'components/tables/eventsTable/setEventView';
import { destroyTables } from 'Pages/Tournament/destroyTable';
import { renderDrawPanel } from './renderDrawPanel';
import { renderTODSdraw } from './renderDraws/renderTODSdraw';
import { highlightTab } from 'navigation';
import { eventsView } from './eventsView';

import { EVENTS_TAB } from 'constants/tmxConstants';

export function renderEventsTab({ eventId, drawId, structureId, renderDraw } = {}) {
  highlightTab(EVENTS_TAB);
  destroyTables();

  if (eventId || drawId) {
    if (drawId && renderDraw) {
      const result = renderDrawPanel({ eventId, drawId });
      if (result.success) {
        renderTODSdraw({ eventId, drawId, structureId });
        setEventView({ renderDraw });
      } else {
        // if draw cannot be rendered, fall back to view of entries
        createEntriesPanels({ eventId, drawId });
        setEventView({ eventId });
      }
    } else {
      createEntriesPanels({ eventId, drawId });
      setEventView({ eventId });
    }
  } else {
    eventsView();
    setEventView({ eventId });
  }
}