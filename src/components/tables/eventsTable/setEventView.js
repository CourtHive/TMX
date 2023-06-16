import { DRAWS_VIEW, ENTRIES_VIEW, EVENTS_TABLE, EVENT_INFO, NONE } from 'constants/tmxConstants';

export function setEventView({ eventId, renderDraw } = {}) {
  const entriesElement = document.getElementById(ENTRIES_VIEW);
  const eventsTableEl = document.getElementById(EVENTS_TABLE);
  const drawsElement = document.getElementById(DRAWS_VIEW);
  const eventInfo = document.getElementById(EVENT_INFO);

  if (eventInfo) eventInfo.style.display = eventId || renderDraw ? '' : NONE;
  if (entriesElement) entriesElement.style.display = eventId && !renderDraw ? '' : NONE;
  if (eventsTableEl) eventsTableEl.style.display = eventId || renderDraw ? NONE : '';
  if (drawsElement) drawsElement.style.display = renderDraw ? '' : NONE;
}
