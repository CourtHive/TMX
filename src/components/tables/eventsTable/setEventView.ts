import {
  DRAWS_HEADER,
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

function setDisplayById(id: string, display: string): void {
  const el = document.getElementById(id);
  if (el) el.style.display = display;
}

export function setEventView({
  eventId,
  renderDraw,
  renderPoints,
}: { eventId?: string; renderDraw?: boolean; renderPoints?: boolean } = {}): void {
  const showEvent = eventId || renderDraw || renderPoints;
  const showOrHide = (visible: boolean | undefined | string) => (visible ? '' : NONE);

  // Tab header (e.g. "Events (5)") — hide when event selected
  const eventsTableEl = document.getElementById(EVENTS_TABLE);
  const tabHeader = eventsTableEl?.closest('.section')?.querySelector('.tabHeader') as HTMLElement | null;
  if (tabHeader) tabHeader.style.display = showOrHide(!showEvent);

  // Zone 1: Event selector — show compact selector when event selected, full table otherwise
  setDisplayById(EVENTS_TABLE, showOrHide(!showEvent));
  setDisplayById(EVENT_SELECTOR_TABLE, showOrHide(showEvent));

  // Zone 2: Tabs bar — visible when event selected
  setDisplayById(EVENT_TABS_BAR, showOrHide(showEvent));

  // Zone 3: Tab content — visible when event selected
  setDisplayById(EVENT_TAB_CONTENT, showOrHide(showEvent));

  // Content visibility within Zone 3
  // EVENT_INFO holds the control bar — visible for draws/entries, hidden for points (no control bar needed)
  setDisplayById(EVENT_INFO, showOrHide(showEvent && !renderPoints));
  setDisplayById(ENTRIES_VIEW, showOrHide(eventId && !renderDraw && !renderPoints));
  setDisplayById(DRAWS_VIEW, showOrHide(renderDraw && !renderPoints));
  setDisplayById(POINTS_VIEW, showOrHide(renderPoints));

  // The draws-list "Draws (N)" header is shown only by `renderDrawsTableView`;
  // every other view path clears it here so it doesn't bleed into entries/points/single-draw.
  setDisplayById(DRAWS_HEADER, NONE);
}
