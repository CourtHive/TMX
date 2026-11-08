/**
 * MatchUp flight (draw) filter for filterPopoverButton: chips when the tournament has two draws (and they fit),
 * otherwise a dropdown (CA 2026-11-08). Filters on the row's drawId; draws are listed in each event's draw order.
 *
 * Draw names are plain text here — the popover writes labels with textContent.
 */
import { createChoiceFilter, type ChipSection } from './chipFilter';
import { orderedDrawDefinitions } from 'functions/drawOrder';
import { tournamentEngine } from 'services/factory/engine';
import { context } from 'services/context';
import { t } from 'i18n';

export function getMatchUpFlightFilter(
  table: any,
  preFetchedEvents?: any[],
): {
  flightOptions: any[];
  flightChips?: ChipSection;
  hasOptions: boolean;
  isFiltered: () => boolean;
  activeIndex: () => number;
} {
  // Caller can hand in a pre-fetched events list to share one q.events()
  // call across the event/flight/team filters on the matchUps tab.
  const events = preFetchedEvents ?? tournamentEngine.q.events() ?? [];
  const items = events.flatMap((event: any) =>
    orderedDrawDefinitions(event).map(({ drawId, drawName }: any) => ({ value: drawId, label: drawName ?? '' })),
  );
  const filter = createChoiceFilter({
    table,
    items,
    allLabel: t('pages.matchUps.allFlights'),
    matches: (rowData, drawId) => rowData.drawId === drawId,
    initial: context.matchUpFilters.drawIds,
    persist: (selected) => (context.matchUpFilters.drawIds = selected),
  });

  return {
    flightOptions: filter.options,
    flightChips: filter.chips,
    hasOptions: filter.hasOptions,
    isFiltered: filter.isFiltered,
    activeIndex: filter.activeIndex,
  };
}
