/**
 * Event tabs bar with Entries, Draws, Rankings tabs and Edit Event button.
 * Renders below the compact event selector when an event is selected.
 */
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { tournamentEngine } from 'tods-competition-factory';
import { editEvent } from './editEvent';

import { EVENT_TABS_BAR } from 'constants/tmxConstants';
import { t } from 'i18n';

const CURSOR_POINTER = 'cursor: pointer';
const ACCENT_BLUE = 'var(--tmx-accent-blue, #3273dc)';

type ActiveTab = 'draws' | 'entries' | 'points';

export function renderEventTabsBar({
  eventId,
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

  const tabs = [entriesTab, drawsTab, pointsTab];

  for (const tab of tabs) {
    const btn = document.createElement('button');
    btn.textContent = tab.label;
    btn.className = 'event-tab-btn';
    const isActive = tab.key === activeTab;
    btn.style.cssText = [
      'padding: 0.5em 1.2em',
      'border: none',
      'background: none',
      CURSOR_POINTER,
      'font-size: 0.95em',
      `font-weight: ${isActive ? '600' : '400'}`,
      `color: ${isActive ? ACCENT_BLUE : 'var(--tmx-text-secondary, #888)'}`,
      `border-bottom: 2px solid ${isActive ? ACCENT_BLUE : 'transparent'}`,
      'margin-bottom: -2px',
      'transition: color 0.15s, border-color 0.15s',
    ].join('; ');
    btn.onmouseenter = () => {
      if (!isActive) btn.style.color = 'var(--tmx-text-primary, #333)';
    };
    btn.onmouseleave = () => {
      if (!isActive) btn.style.color = 'var(--tmx-text-secondary, #888)';
    };
    btn.onclick = tab.onClick;
    tabsLeft.appendChild(btn);
  }

  bar.appendChild(tabsLeft);

  // Right-side: Edit Event button + optional extra controls (e.g. Rankings policy selectors)
  const rightWrapper = document.createElement('div');
  rightWrapper.style.cssText = 'display: flex; align-items: center; gap: 0.5em; margin-right: 0.5em; margin-bottom: 4px;';

  if (rightContent) {
    rightWrapper.appendChild(rightContent);
  }

  const event = tournamentEngine.getEvent({ eventId })?.event;
  if (event) {
    const editBtn = document.createElement('button');
    editBtn.textContent = t('pages.events.editEventAction', 'Edit Event');
    editBtn.style.cssText = [
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
    editBtn.onmouseenter = () => {
      editBtn.style.background = ACCENT_BLUE;
      editBtn.style.color = '#fff';
    };
    editBtn.onmouseleave = () => {
      editBtn.style.background = 'transparent';
      editBtn.style.color = ACCENT_BLUE;
    };
    editBtn.onclick = () => editEvent({ event, callback: () => navigateToEvent({ eventId }) });
    rightWrapper.appendChild(editBtn);
  }

  bar.appendChild(rightWrapper);

  container.appendChild(bar);
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
  msg.textContent = 'No draws have been created for this event.';
  msg.style.cssText = 'color: var(--tmx-text-secondary, #888); font-size: 1em; margin: 0;';
  placeholder.appendChild(msg);

  const btn = document.createElement('button');
  btn.textContent = t('pages.events.addDraw', 'Add draw');
  btn.style.cssText = [
    'padding: 0.6em 1.5em',
    'border: none',
    `background: ${ACCENT_BLUE}`,
    'color: #fff',
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
