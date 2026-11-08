/**
 * MatchUp event filter for filterPopoverButton: chips when the tournament has two events (and they fit), otherwise
 * a dropdown (CA 2026-11-08). Filters on the row's eventId.
 *
 * Event names are plain text here — the popover writes labels with textContent. They were HTML-escaped, which
 * showed "Men's Singles" as "Men&#39;s Singles".
 */
import { createChoiceFilter, type ChipSection } from './chipFilter';
import { tournamentEngine } from 'services/factory/engine';
import { context } from 'services/context';
import { t } from 'i18n';

export function getMatchUpEventFilter(
  table: any,
  preFetchedEvents?: any[],
): {
  eventOptions: any[];
  eventChips?: ChipSection;
  hasOptions: boolean;
  isFiltered: () => boolean;
  activeIndex: () => number;
} {
  // Caller can hand in a pre-fetched events list to share one q.events()
  // call across the event/flight/team filters on the matchUps tab.
  const events = preFetchedEvents ?? tournamentEngine.q.events() ?? [];
  const filter = createChoiceFilter({
    table,
    items: events.map((event: any) => ({ value: event.eventId, label: event.eventName ?? '' })),
    allLabel: t('pages.matchUps.allEvents'),
    matches: (rowData, eventId) => rowData.eventId === eventId,
    initial: context.matchUpFilters.eventIds,
    persist: (selected) => (context.matchUpFilters.eventIds = selected),
  });

  return {
    eventOptions: filter.options,
    eventChips: filter.chips,
    hasOptions: filter.hasOptions,
    isFiltered: filter.isFiltered,
    activeIndex: filter.activeIndex,
  };
}
