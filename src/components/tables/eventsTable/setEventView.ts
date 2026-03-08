import { DRAWS_VIEW, ENTRIES_VIEW, EVENTS_TABLE, EVENT_INFO, NONE, POINTS_VIEW } from 'constants/tmxConstants';

export function setEventView({
  eventId,
  renderDraw,
  renderPoints,
}: { eventId?: string; renderDraw?: boolean; renderPoints?: boolean } = {}): void {
  const entriesElement = document.getElementById(ENTRIES_VIEW);
  const eventsTableEl = document.getElementById(EVENTS_TABLE);
  const drawsElement = document.getElementById(DRAWS_VIEW);
  const pointsElement = document.getElementById(POINTS_VIEW);
  const eventInfo = document.getElementById(EVENT_INFO);

  const showEvent = eventId || renderDraw || renderPoints;

  if (eventInfo) eventInfo.style.display = showEvent ? '' : NONE;
  if (entriesElement) entriesElement.style.display = eventId && !renderDraw && !renderPoints ? '' : NONE;
  if (eventsTableEl) eventsTableEl.style.display = showEvent ? NONE : '';
  if (drawsElement) drawsElement.style.display = renderDraw && !renderPoints ? '' : NONE;
  if (pointsElement) pointsElement.style.display = renderPoints ? '' : NONE;
}
