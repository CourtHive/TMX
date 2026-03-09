import {
  DRAWS_VIEW,
  ENTRIES_VIEW,
  EVENTS_TABLE,
  EVENT_INFO,
  EVENT_SELECTOR_TABLE,
  EVENT_TAB_CONTENT,
  EVENT_TABS_BAR,
  NONE,
  POINTS_VIEW,
} from 'constants/tmxConstants';

export function setEventView({
  eventId,
  renderDraw,
  renderPoints,
}: { eventId?: string; renderDraw?: boolean; renderPoints?: boolean } = {}): void {
  const entriesElement = document.getElementById(ENTRIES_VIEW);
  const eventsTableEl = document.getElementById(EVENTS_TABLE);
  const selectorTableEl = document.getElementById(EVENT_SELECTOR_TABLE);
  const drawsElement = document.getElementById(DRAWS_VIEW);
  const pointsElement = document.getElementById(POINTS_VIEW);
  const eventInfo = document.getElementById(EVENT_INFO);
  const tabsBar = document.getElementById(EVENT_TABS_BAR);
  const tabContent = document.getElementById(EVENT_TAB_CONTENT);

  const showEvent = eventId || renderDraw || renderPoints;

  // Tab header (e.g. "Events (5)") — hide when event selected
  const tabHeader = eventsTableEl?.closest('.section')?.querySelector('.tabHeader') as HTMLElement | null;
  if (tabHeader) tabHeader.style.display = showEvent ? NONE : '';

  // Zone 1: Event selector — show compact selector when event selected, full table otherwise
  if (eventsTableEl) eventsTableEl.style.display = showEvent ? NONE : '';
  if (selectorTableEl) selectorTableEl.style.display = showEvent ? '' : NONE;

  // Zone 2: Tabs bar — visible when event selected
  if (tabsBar) tabsBar.style.display = showEvent ? '' : NONE;

  // Zone 3: Tab content — visible when event selected
  if (tabContent) tabContent.style.display = showEvent ? '' : NONE;

  // Content visibility within Zone 3
  // EVENT_INFO holds the control bar — visible for draws/entries, hidden for points (no control bar needed)
  if (eventInfo) eventInfo.style.display = showEvent && !renderPoints ? '' : NONE;
  if (entriesElement) entriesElement.style.display = eventId && !renderDraw && !renderPoints ? '' : NONE;
  if (drawsElement) drawsElement.style.display = renderDraw && !renderPoints ? '' : NONE;
  if (pointsElement) pointsElement.style.display = renderPoints ? '' : NONE;
}
