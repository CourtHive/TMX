/**
 * Compact event selector shown when an event is selected.
 * Replaces the full events table with a small scrollable list for quick switching.
 */
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { tournamentEngine } from 'tods-competition-factory';

import { EVENTS_TABLE, EVENT_SELECTOR_TABLE, NONE } from 'constants/tmxConstants';

const ACCENT_BLUE = 'var(--tmx-accent-blue, #3273dc)';
const BORDER_PRIMARY = 'var(--tmx-border-primary, #ddd)';
const TEXT_PRIMARY = 'var(--tmx-text-primary, #333)';
const BG_PRIMARY = 'var(--tmx-bg-primary, #fff)';

function navButtonStyles(enabled: boolean): string {
  return [
    'padding: 0.2em 0.5em',
    'border-radius: 4px',
    `border: 1px solid ${enabled ? BORDER_PRIMARY : 'transparent'}`,
    `background: ${enabled ? BG_PRIMARY : 'transparent'}`,
    `color: ${enabled ? TEXT_PRIMARY : 'var(--tmx-text-secondary, #aaa)'}`,
    `cursor: ${enabled ? 'pointer' : 'default'}`,
    'font-size: 0.85em',
    'font-weight: 600',
    'line-height: 1',
    `opacity: ${enabled ? '1' : '0.4'}`,
    'transition: all 0.15s',
  ].join('; ');
}

function chipStyles(isSelected: boolean): string {
  return [
    'padding: 0.3em 0.8em',
    'border-radius: 16px',
    `border: 1px solid ${isSelected ? ACCENT_BLUE : BORDER_PRIMARY}`,
    `background: ${isSelected ? ACCENT_BLUE : BG_PRIMARY}`,
    `color: ${isSelected ? '#fff' : TEXT_PRIMARY}`,
    'cursor: pointer',
    'font-size: 0.85em',
    'white-space: nowrap',
    `font-weight: ${isSelected ? '600' : '400'}`,
    'transition: all 0.15s',
  ].join('; ');
}

export function renderEventSelector({ eventId }: { eventId: string }): void {
  const eventsTableEl = document.getElementById(EVENTS_TABLE);
  const selectorEl = document.getElementById(EVENT_SELECTOR_TABLE);
  if (!selectorEl) return;

  // Hide full table, show compact selector
  if (eventsTableEl) eventsTableEl.style.display = NONE;
  selectorEl.style.display = '';
  selectorEl.innerHTML = '';

  const events = tournamentEngine.getEvents()?.events || [];
  if (!events.length) return;

  const manyEvents = events.length > 6;

  const wrapper = document.createElement('div');
  wrapper.className = 'event-selector';
  wrapper.style.cssText = 'display: flex; gap: 0.5em; align-items: center; padding: 0.4em 0.5em; overflow-x: auto; width: 100%; box-sizing: border-box;';

  if (manyEvents) {
    const selectedIndex = events.findIndex((e: any) => e.eventId === eventId);

    // [<<] Previous event button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'event-selector-nav';
    prevBtn.innerHTML = '&#171;'; // «
    prevBtn.title = 'Previous event';
    prevBtn.style.cssText = navButtonStyles(selectedIndex > 0);
    prevBtn.disabled = selectedIndex <= 0;
    if (selectedIndex > 0) {
      prevBtn.onclick = () => {
        const prev = events[selectedIndex - 1];
        const draws = prev.drawDefinitions || [];
        navigateToEvent({ eventId: prev.eventId, renderDraw: draws.length > 0, drawId: draws.length === 1 ? draws[0].drawId : undefined });
      };
    }
    wrapper.appendChild(prevBtn);

    // Selected event chip
    const selectedEvent = events.find((e: any) => e.eventId === eventId);
    if (selectedEvent) {
      const chip = document.createElement('button');
      chip.className = 'event-selector-chip';
      chip.textContent = selectedEvent.eventName;
      chip.style.cssText = chipStyles(true);
      wrapper.appendChild(chip);
    }

    // [>>] Next event button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'event-selector-nav';
    nextBtn.innerHTML = '&#187;'; // »
    nextBtn.title = 'Next event';
    nextBtn.style.cssText = navButtonStyles(selectedIndex < events.length - 1);
    nextBtn.disabled = selectedIndex >= events.length - 1;
    if (selectedIndex < events.length - 1) {
      nextBtn.onclick = () => {
        const next = events[selectedIndex + 1];
        const draws = next.drawDefinitions || [];
        navigateToEvent({ eventId: next.eventId, renderDraw: draws.length > 0, drawId: draws.length === 1 ? draws[0].drawId : undefined });
      };
    }
    wrapper.appendChild(nextBtn);
  } else {
    for (const event of events) {
      const isSelected = event.eventId === eventId;
      const chip = document.createElement('button');
      chip.className = 'event-selector-chip';
      chip.textContent = event.eventName;
      chip.style.cssText = chipStyles(isSelected);
      if (!isSelected) {
        chip.onmouseenter = () => {
          chip.style.borderColor = ACCENT_BLUE;
          chip.style.color = ACCENT_BLUE;
        };
        chip.onmouseleave = () => {
          chip.style.borderColor = BORDER_PRIMARY;
          chip.style.color = TEXT_PRIMARY;
        };
      }
      chip.onclick = () => {
        if (!isSelected) {
          const draws = event.drawDefinitions || [];
          const drawId = draws.length === 1 ? draws[0].drawId : undefined;
          navigateToEvent({ eventId: event.eventId, renderDraw: draws.length > 0, drawId });
        }
      };
      wrapper.appendChild(chip);
    }
  }

  // "All events" link to return to full table
  const allLink = document.createElement('button');
  allLink.textContent = 'All Events';
  allLink.style.cssText =
    'padding: 0.3em 0.8em; border: none; background: none; color: var(--tmx-text-secondary, #888); cursor: pointer; font-size: 0.85em; white-space: nowrap; text-decoration: underline;';
  allLink.onclick = () => navigateToEvent({});
  wrapper.appendChild(allLink);

  selectorEl.appendChild(wrapper);
}

export function hideEventSelector(): void {
  const eventsTableEl = document.getElementById(EVENTS_TABLE);
  const selectorEl = document.getElementById(EVENT_SELECTOR_TABLE);
  if (eventsTableEl) eventsTableEl.style.display = '';
  if (selectorEl) selectorEl.style.display = NONE;
}
