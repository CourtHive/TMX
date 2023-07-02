import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { importTournaments } from '../../services/storage/importTournaments';
import { addTournament } from 'components/drawers/addTournamentDrawer';
import { getLoginState } from 'services/authentication/loginState';
import { controlBar } from 'components/controlBar/controlBar';
import { legacyImport } from 'services/storage/legacyImport';
import { serverSync } from 'services/storage/serverSync';
import { mainMenu } from 'components/menus/mainMenu';
import { mockTournaments } from './mockTournaments';
import { context } from 'services/context';

import { LEFT, RIGHT, TMX_TOURNAMENTS, TOURNAMENTS_CONTROL } from 'constants/tmxConstants';

export function calendarControls(table) {
  const state = getLoginState();

  const newOptions = [
    { label: 'Create new tournament', onClick: () => addTournament({ table }) },
    { label: 'Import tournament', onClick: () => importTournaments(table) },
    { divider: true },
    { label: 'Sync with Server', onClick: serverSync, close: true },
    { label: 'Import legacy', onClick: () => legacyImport(table), close: true },
    { divider: true },
    { label: 'Example Tournaments', onClick: () => mockTournaments(table), close: true }
  ];

  const setSearchFilter = createSearchFilter(table);

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
      onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && setSearchFilter(''),
      onChange: (e) => setSearchFilter(e.target.value),
      onKeyUp: (e) => setSearchFilter(e.target.value),
      placeholder: 'Search tournaments',
      location: LEFT,
      search: true
    }
  ];

  const target = document.getElementById(TOURNAMENTS_CONTROL);
  controlBar({ target, items });
}
