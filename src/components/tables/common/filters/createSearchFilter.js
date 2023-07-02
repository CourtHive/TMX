export const createSearchFilter = (target) => {
  let searchFilter;
  const tables = Array.isArray(target) ? target : [target];

  return (value) => {
    if (searchFilter) tables.forEach((table) => table.removeFilter(searchFilter));
    if (value) {
      const searchText = value?.toLowerCase();
      searchFilter = (rowData) => rowData.searchText?.includes(searchText);
      tables.forEach((table) => table.addFilter(searchFilter));
    } else {
      searchFilter = undefined;
    }
  };
};
