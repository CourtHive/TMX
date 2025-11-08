import { getChildrenByClassName, getParent } from 'services/dom/parentAndChild';
import { isFunction } from 'functions/typeOf';

import { LEFT } from 'constants/tmxConstants';

export const searchField =
  (location?: string, selected?: string, onEnter?: (table: any) => boolean) =>
  (table: any, placeholder = 'Search participants'): any => {
    let selectedValues: any[];
    let searchFilter: (rowData: any) => boolean;

    const updateSearchFilter = (value: string) => {
      const parentElement = selected && getParent(table.element, 'tableClass');
      if (parentElement) {
        const controlBar = getChildrenByClassName(parentElement, 'controlBar')?.[0];
        if (controlBar) {
          const search = getChildrenByClassName(controlBar, 'search');
          Array.from(search).forEach((el: any) => (el.value = value));
        }
      }

      selectedValues = selected ? table.getSelectedData().map((r: any) => r[selected]) : [];
      table.removeFilter(searchFilter);
      searchFilter = (rowData: any) =>
        rowData.searchText?.includes(value?.toLowerCase()) ||
        (selectedValues?.length && selectedValues.includes(rowData[selected || '']));
      if (value) table.addFilter(searchFilter);
    };

    return {
      onKeyDown: (e: any) => {
        e.keyCode === 8 && e.target.value.length === 1 && updateSearchFilter('');
        if ((e.key === 'Enter' || e.keyCode === 13) && isFunction(onEnter) && onEnter) {
          const clear = onEnter(table);
          if (clear) updateSearchFilter('');
        }
      },
      onChange: (e: any) => updateSearchFilter(e.target.value),
      onKeyUp: (e: any) => updateSearchFilter(e.target.value),
      location: location || LEFT,
      class: 'search',
      search: true,
      placeholder
    };
  };
