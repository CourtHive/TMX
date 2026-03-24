import { context } from 'services/context';

export const createSearchFilter = (
  target: any,
  { persistKey, filterContext = 'matchUpFilters' }: { persistKey?: string; filterContext?: 'matchUpFilters' | 'participantFilters' } = {},
): any => {
  let searchFilter;
  const tables = Array.isArray(target) ? target : [target];

  const filters = context[filterContext];

  const applyFilter = (value) => {
    if (searchFilter) tables.forEach((table) => table.removeFilter(searchFilter));
    if (value) {
      const searchText = value?.toLowerCase();
      searchFilter = (rowData) => rowData.searchText?.includes(searchText);
      tables.forEach((table) => table.addFilter(searchFilter));
    } else {
      searchFilter = undefined;
    }
    if (persistKey) filters[persistKey] = value || undefined;
  };

  // Restore saved filter
  const saved = persistKey && filters[persistKey];
  if (saved) applyFilter(saved);

  return applyFilter;
};
