import { importTournaments } from '../../services/storage/importTournaments';
import { addTournament } from 'components/drawers/addTournamentDrawer';
import { getLoginState } from 'services/authentication/loginState';
import { controlBar } from 'components/controlBar/controlBar';
import { legacyImport } from 'services/storage/legacyImport';
import { serverSync } from 'services/storage/serverSync';
import { mainMenu } from 'components/menus/mainMenu';
import { context } from 'services/context';

import { LEFT, RIGHT, TMX_TOURNAMENTS, TOURNAMENTS_CONTROL } from 'constants/tmxConstants';

export function calendarControls(table) {
  const state = getLoginState();

  const categoryOptions = ['All', '18U', '16U'].map((category) => ({
    onClick: () => console.log(category),
    label: category,
    close: true
  }));

  const newOptions = [
    { label: 'Create New Tournament', onClick: () => addTournament({ table }) },
    { label: 'Import tournament', onClick: () => importTournaments(table) },
    { divider: true },
    { label: 'Sync with Server', onClick: serverSync, close: true },
    { label: 'Import legacy', onClick: () => legacyImport(table), close: true }
  ];

  // SEARCH filter
  let searchText;
  const searchFilter = (rowData) => rowData.searchText?.includes(searchText);
  const updateSearchFilter = (value) => {
    if (!value) table.removeFilter(searchFilter);
    searchText = value;
    if (value) table.addFilter(searchFilter);
  };

  const items = [
    { label: 'New', options: newOptions, align: RIGHT },
    {
      label: 'Menu',
      onClick: () =>
        context.drawer.open({
          title: state?.provider?.providerName || 'TMX',
          context: TMX_TOURNAMENTS,
          content: mainMenu,
          width: '200px',
          side: RIGHT
        })
    },
    {
      onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && updateSearchFilter(''),
      onChange: (e) => updateSearchFilter(e.target.value),
      onKeyUp: (e) => updateSearchFilter(e.target.value),
      placeholder: 'Search tournaments',
      location: LEFT,
      search: true
    },
    {
      options: categoryOptions,
      modifyLabel: true,
      label: 'Category',
      selection: true,
      location: LEFT,
      append: true
    }
  ];

  const target = document.getElementById(TOURNAMENTS_CONTROL);
  controlBar({ target, items });
}
