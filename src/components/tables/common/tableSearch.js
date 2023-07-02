import { getChildrenByClassName, getParent } from 'services/dom/parentAndChild';
import { isFunction } from 'functions/typeOf';

import { LEFT } from 'constants/tmxConstants';

export const searchField =
  (location, selected, onEnter) =>
  (table, placeholder = 'Search participants') => {
    let searchText;
    let selectedValues;
    const searchFilter = (rowData) =>
      rowData.searchText?.includes(searchText) ||
      (selectedValues?.length && selectedValues.includes(rowData[selected]));

    const updateSearchFilter = (value) => {
      // IF: selected is being used...
      // THEN: look for a 'controlBar' in parent 'tableClass'...
      // AND: keep any other search elements values in sync
      const parentElement = selected && getParent(table.element, 'tableClass');
      if (parentElement) {
        const controlBar = getChildrenByClassName(parentElement, 'controlBar')?.[0];
        if (controlBar) {
          const search = getChildrenByClassName(controlBar, 'search');
          Array.from(search).forEach((el) => (el.value = value));
        }
      }

      selectedValues = selected && table.getSelectedData().map((r) => r[selected]);
      table.clearFilter();
      searchText = value?.toLowerCase();
      if (value) table.addFilter(searchFilter);
    };

    return {
      onKeyDown: (e) => {
        e.keyCode === 8 && e.target.value.length === 1 && updateSearchFilter('');
        if ((e.key === 'Enter' || e.keyCode === 13) && isFunction(onEnter)) {
          const clear = onEnter(table);
          if (clear) updateSearchFilter('');
        }
      },
      onChange: (e) => updateSearchFilter(e.target.value),
      onKeyUp: (e) => updateSearchFilter(e.target.value),
      location: location || LEFT,
      class: 'search',
      search: true,
      placeholder
    };
  };
