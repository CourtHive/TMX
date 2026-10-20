import type { CatalogMatchUpItem, CatalogFilters } from 'courthive-components';

type FilterSection = { key: keyof CatalogFilters; labelKey: string; values: string[] };

const DIMENSIONS: Array<{ key: keyof CatalogFilters; field: keyof CatalogMatchUpItem; labelKey: string }> = [
  { key: 'eventType', field: 'matchUpType', labelKey: 'schedule.filterAllEventTypes' },
  { key: 'eventName', field: 'eventName', labelKey: 'schedule.filterAllEvents' },
  { key: 'drawName', field: 'drawName', labelKey: 'schedule.filterAllFlights' },
  { key: 'gender', field: 'gender', labelKey: 'schedule.filterAllGenders' },
  { key: 'roundName', field: 'roundName', labelKey: 'schedule.filterAllRounds' },
];

function availableSections(items: CatalogMatchUpItem[]): FilterSection[] {
  return DIMENSIONS.map(({ key, field, labelKey }) => {
    const values = new Set<string>();
    for (const item of items) {
      const value = item[field];
      if (typeof value === 'string' && value) values.add(value);
    }
    return { key, labelKey, values: [...values].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })) };
  });
}

/** Validate each dimension independently: a valid combination may still match no cards. */
export function reconcileScheduledFilters(filters: CatalogFilters, items: CatalogMatchUpItem[]): CatalogFilters {
  const retained: CatalogFilters = {};
  for (const { key, values } of availableSections(items)) {
    const selected = filters[key];
    if (selected && new Set(values).has(selected)) retained[key] = selected;
  }
  return retained;
}

/** Active selections must always have a visible, selected, removable option. */
export function scheduledFilterSections(items: CatalogMatchUpItem[], filters: CatalogFilters): FilterSection[] {
  return availableSections(items)
    .filter(({ key, values }) => values.length > 1 || !!filters[key])
    .map((section) => {
      const selected = filters[section.key];
      return selected && !new Set(section.values).has(selected)
        ? { ...section, values: [...section.values, selected] }
        : section;
    });
}
