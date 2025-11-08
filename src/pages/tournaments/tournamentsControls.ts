/**
 * Tournament calendar control bar with actions and search.
 * Provides create, import, fetch, and load tournament actions with admin permissions check.
 */
import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { fetchTournamentDetailsModal } from 'components/modals/fetchTournamentDetails';
import { importTournaments } from '../../services/storage/importTournaments';
import { loadTournamentById } from 'components/modals/loadTournamentById';
import { editTournament } from 'components/drawers/editTournamentDrawer';
import { getLoginState } from 'services/authentication/loginState';
import { controlBar } from 'components/controlBar/controlBar';
import { mockTournaments } from './mockTournaments';

import { LEFT, RIGHT, SUPER_ADMIN, TOURNAMENTS_CONTROL } from 'constants/tmxConstants';

export function calendarControls(table: any): void {
  const state = getLoginState();
  const admin = state?.roles?.includes(SUPER_ADMIN);
  const fetch = state?.services?.includes('tournamentProfile');

  const actions = [
    { label: 'Create new tournament', onClick: () => (editTournament as any)({ table }) },
    { label: 'Import tournament', onClick: () => importTournaments({ table }) },
    fetch && { label: 'Fetch tournament', onClick: () => fetchTournamentDetailsModal({ table }) },
    admin && { label: 'Load by ID', onClick: () => loadTournamentById({ table }) },
    { divider: true },
    { divider: true },
    { label: 'Example tournaments', onClick: () => mockTournaments(table), close: true },
  ].filter(Boolean);

  const setSearchFilter = createSearchFilter(table);

  const items = [
    { label: 'Actions', options: actions, align: RIGHT },
    {
      onKeyDown: (e: KeyboardEvent) => e.keyCode === 8 && (e.target as HTMLInputElement).value.length === 1 && setSearchFilter(''),
      onChange: (e: Event) => setSearchFilter((e.target as HTMLInputElement).value),
      onKeyUp: (e: Event) => setSearchFilter((e.target as HTMLInputElement).value),
      clearSearch: () => setSearchFilter(''),
      placeholder: 'Search tournaments',
      id: 'tournamentSearch',
      location: LEFT,
      search: true,
    },
  ];

  const target = document.getElementById(TOURNAMENTS_CONTROL);
  controlBar({ target, items });
}
