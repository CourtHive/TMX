/**
 * Event tabs bar with Entries, Draws, Rankings tabs and Edit Event button.
 * Renders below the compact event selector when an event is selected.
 */
import {
  abandonTopologyDraft,
  navigateToTopology,
  otherFlightsWithoutDraws,
  useDesignForOtherFlights,
} from 'pages/tournament/topologyPage';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { confirmModal } from 'components/modals/baseModal/baseModal';
import { hasTopologyDraft } from 'pages/tournament/topologyDrafts';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { tournamentEngine } from 'services/factory/engine';
import { editEvent } from './editEvent';

import { EVENT_TABS_BAR, TOPOLOGY_FLIGHTS_DESIGN } from 'constants/tmxConstants';
import { t } from 'i18n';

const CURSOR_POINTER = 'cursor: pointer';
const BORDER_NONE = 'border: none';
// Used as a fill under its own ink: the accent itself lightens in dark palettes.
const ACCENT_BLUE = 'var(--tmx-fill-accent)';
const ON_ACCENT = 'var(--chc-on-link)';
const TEXT_SECONDARY = 'var(--tmx-text-secondary, #888)';

type ActiveTab = 'draws' | 'entries' | 'points' | 'builder';

export function renderEventTabsBar({
  eventId,
  drawId,
  activeTab,
  rightContent,
}: {
  eventId: string;
  drawId?: string;
  activeTab: ActiveTab;
  rightContent?: HTMLElement;
}): void {
  const container = document.getElementById(EVENT_TABS_BAR);
  if (!container) return;

  container.style.display = '';
  container.innerHTML = '';

  const bar = document.createElement('div');
  bar.className = 'event-tabs-bar';
  bar.style.cssText =
    'display: flex; align-items: center; gap: 0; width: 100%; border-bottom: 2px solid var(--tmx-border-primary, #ddd); margin-bottom: 0.5em; padding: 0 0.5em;';

  const tabsLeft = document.createElement('div');
  tabsLeft.style.cssText = 'display: flex; gap: 0; flex: 1;';

  const drawsTab = {
    label: t('pages.events.draws', 'Draws'),
    key: 'draws' as ActiveTab,
    onClick: () => {
      navigateToEvent({ eventId, renderDraw: true });
    },
  };

  const entriesTab = {
    label: t('pages.events.entries', 'Entries'),
    key: 'entries' as ActiveTab,
    onClick: () => navigateToEvent({ eventId }),
  };

  const pointsTab = {
    label: t('pages.events.rankings', 'Rankings'),
    key: 'points' as ActiveTab,
    onClick: () => navigateToEvent({ eventId, renderPoints: true }),
  };

  // The draw builder is one of the event's views (CA, 2026-11-17): its tab is there while it is open, and while a draw
  // being built is kept for the event, so the director can go back to it
  const building = activeTab === 'builder';
  // building a flight's draw, the tab names the flight
  const flight =
    building && drawId
      ? tournamentEngine.q.flightProfile({ eventId })?.flights?.find((f: any) => f.drawId === drawId)
      : undefined;
  const builderTab = {
    label: flight ? `${t('pages.events.drawBuilder')} \u00B7 ${flight.drawName}` : t('pages.events.drawBuilder'),
    key: 'builder' as ActiveTab,
    onClick: () => navigateToTopology({ eventId }),
    discard: !building && hasTopologyDraft(eventId),
  };

  const tabs: { label: string; key: ActiveTab; onClick: () => void; discard?: boolean }[] = [
    entriesTab,
    drawsTab,
    pointsTab,
    ...(building || builderTab.discard ? [builderTab] : []),
  ];

  for (const tab of tabs) {
    const btn = document.createElement('button');
    btn.textContent = tab.label;
    btn.className = 'event-tab-btn';
    const isActive = tab.key === activeTab;
    btn.style.cssText = [
      'padding: 0.5em 1.2em',
      BORDER_NONE,
      'background: none',
      CURSOR_POINTER,
      'font-size: 0.95em',
      `font-weight: ${isActive ? '600' : '400'}`,
      `color: ${isActive ? ACCENT_BLUE : TEXT_SECONDARY}`,
      `border-bottom: 2px solid ${isActive ? ACCENT_BLUE : 'transparent'}`,
      'margin-bottom: -2px',
      'transition: color 0.15s, border-color 0.15s',
    ].join('; ');
    btn.onmouseenter = () => {
      if (!isActive) btn.style.color = 'var(--tmx-text-primary, #333)';
    };
    btn.onmouseleave = () => {
      if (!isActive) btn.style.color = TEXT_SECONDARY;
    };
    btn.onclick = tab.onClick;
    tabsLeft.appendChild(btn);
    if (tab.discard)
      tabsLeft.appendChild(discardDraftButton(eventId, () => renderEventTabsBar({ eventId, activeTab, rightContent })));
  }

  bar.appendChild(tabsLeft);

  // Right-side: Edit Event button + optional extra controls (e.g. Rankings policy selectors)
  const rightWrapper = document.createElement('div');
  rightWrapper.style.cssText =
    'display: flex; align-items: center; gap: 0.5em; margin-right: 0.5em; margin-bottom: 4px;';

  if (rightContent) {
    rightWrapper.appendChild(rightContent);
  }

  // building a flight's draw: its design can be the draft of the event's other flights without a draw (CA, 2026-11-18)
  if (flight && otherFlightsWithoutDraws(eventId, flight.drawId).length) {
    const share = outlinedButton(t('topology.useForOtherFlights'));
    share.id = TOPOLOGY_FLIGHTS_DESIGN;
    share.title = t('topology.useForOtherFlightsTitle');
    share.onclick = (e) => {
      e.stopPropagation();
      useDesignForOtherFlights(eventId);
    };
    rightWrapper.appendChild(share);
  }

  const event = tournamentEngine.q.event({ eventId });
  if (event) {
    const editBtn = outlinedButton(t('pages.events.editEventAction', 'Edit Event'));
    editBtn.onclick = (e) => {
      e.stopPropagation();
      editEvent({ event, callback: () => navigateToEvent({ eventId }) });
    };
    rightWrapper.appendChild(editBtn);
  }

  bar.appendChild(rightWrapper);

  container.appendChild(bar);
}

/**
 * The draft's tab carries its own discard: a draw being built is let go only when asked. It is offered only while
 * another of the event's views is showing, so the bar is redrawn in place: that view's route is the current one.
 */
function discardDraftButton(eventId: string, redraw: () => void): HTMLElement {
  const label = t('topology.discardDraft');
  const discard = document.createElement('button');
  discard.type = 'button';
  discard.className = 'event-tab-discard';
  discard.textContent = '\u00D7';
  discard.title = label;
  discard.setAttribute('aria-label', label);
  discard.style.cssText = [
    BORDER_NONE,
    'background: none',
    CURSOR_POINTER,
    'padding: 0 0.4em',
    'margin-left: -0.9em',
    `color: ${TEXT_SECONDARY}`,
  ].join('; ');
  discard.onclick = (e) => {
    e.stopPropagation();
    confirmModal({
      title: label,
      query: t('topology.discardDraftQuery'),
      okIntent: 'is-danger',
      cancelAction: undefined,
      okAction: () => {
        abandonTopologyDraft(eventId);
        redraw();
      },
    });
  };
  return discard;
}

/**
 * Render an "Add Draw" prompt in the draws content area when no draws exist.
 */
export function renderNoDrawsPlaceholder({
  eventId,
  target,
  onDrawAdded,
}: {
  eventId: string;
  target: HTMLElement;
  onDrawAdded?: (result: any) => void;
}): void {
  const placeholder = document.createElement('div');
  placeholder.style.cssText =
    'display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3em; gap: 1em;';

  const msg = document.createElement('p');
  msg.textContent = t('drawActions.noDrawsForEvent');
  msg.style.cssText = 'color: var(--tmx-text-secondary, #888); font-size: 1em; margin: 0;';
  placeholder.appendChild(msg);

  const btn = document.createElement('button');
  btn.textContent = t('pages.events.addDraw', 'Add draw');
  btn.style.cssText = [
    'padding: 0.6em 1.5em',
    BORDER_NONE,
    `background: ${ACCENT_BLUE}`,
    `color: ${ON_ACCENT}`,
    'border-radius: 4px',
    CURSOR_POINTER,
    'font-size: 0.95em',
    'font-weight: 500',
  ].join('; ');
  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addDraw({ eventId, callback: onDrawAdded });
  };
  placeholder.appendChild(btn);

  target.appendChild(placeholder);
}

/** A button in the bar's outlined accent style, as Edit Event's. */
function outlinedButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.style.cssText = [
    'padding: 0.4em 1em',
    `border: 1px solid ${ACCENT_BLUE}`,
    'background: transparent',
    `color: ${ACCENT_BLUE}`,
    'border-radius: 4px',
    CURSOR_POINTER,
    'font-size: 0.85em',
    'font-weight: 500',
    'white-space: nowrap',
    'transition: background 0.15s, color 0.15s',
  ].join('; ');
  button.onmouseenter = () => {
    button.style.background = ACCENT_BLUE;
    button.style.color = ON_ACCENT;
  };
  button.onmouseleave = () => {
    button.style.background = 'transparent';
    button.style.color = ACCENT_BLUE;
  };
  return button;
}
