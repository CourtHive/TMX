/**
 * Tournament calendar control bar with actions and search.
 * Provides create, import, fetch, and load tournament actions with admin permissions check.
 */
import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { fetchTournamentDetailsModal } from 'components/modals/fetchTournamentDetails';
import { importTournaments } from '../../services/storage/importTournaments';
import { loadTournamentById } from 'components/modals/loadTournamentById';
import { editTournament } from 'components/drawers/editTournamentDrawer';
import { renderWelcomeView } from 'pages/tournaments/welcomeView';
import { getLoginState } from 'services/authentication/loginState';
import { destroyTable } from 'pages/tournament/destroyTable';
import { listPicker } from 'components/modals/listPicker';
import { controlBar } from 'courthive-components';
import { mockTournaments, EXAMPLE_TOURNAMENT_CATALOG } from './mockTournaments';
import { context } from 'services/context';
import { t } from 'i18n';

// constants
import {
  LEFT,
  RIGHT,
  SUPER_ADMIN,
  TMX_TOURNAMENTS,
  TOURNAMENTS_CONTROL,
  TOURNAMENTS_TABLE,
} from 'constants/tmxConstants';

export function calendarControls(table: any): void {
  const state = getLoginState();
  const admin = state?.roles?.includes(SUPER_ADMIN);
  const fetch = state?.services?.includes('tournamentProfile');

  const showWelcome = () => {
    destroyTable({ anchorId: TOURNAMENTS_TABLE });
    const controlEl = document.getElementById(TOURNAMENTS_CONTROL);
    if (controlEl) controlEl.innerHTML = '';

    const calendarAnchor = document.getElementById(TOURNAMENTS_TABLE);
    if (calendarAnchor) {
      const navigate = () => context.router?.navigate(`/${TMX_TOURNAMENTS}/${Date.now()}`);
      renderWelcomeView(calendarAnchor, {
        onGenerate: () => {
          const options = [{ label: 'All', value: -1 }, ...EXAMPLE_TOURNAMENT_CATALOG];
          listPicker({
            options,
            callback: ({ selection }: any) => {
              const value = selection?.selection?.value;
              const indices = value === -1 ? undefined : [value];
              mockTournaments(undefined, navigate, indices);
            },
          });
        },
        onCreate: () => editTournament({ onCreated: navigate }),
        onBack: navigate,
      });
    }
  };

  const actions = [
    { label: 'Import tournament', onClick: () => importTournaments({ table }) },
    fetch && { label: 'Fetch tournament', onClick: () => fetchTournamentDetailsModal({ table }) },
    admin && { label: 'Load by ID', onClick: () => loadTournamentById({ table }) },
    { divider: true },
    { divider: true },
    {
      label: 'Example tournaments',
      onClick: () => {
        const options = [{ label: 'All', value: -1 }, ...EXAMPLE_TOURNAMENT_CATALOG];
        listPicker({
          options,
          callback: ({ selection }: any) => {
            const value = selection?.selection?.value;
            const indices = value === -1 ? undefined : [value];
            mockTournaments(table, undefined, indices);
          },
        });
      },
      close: true,
    },
    { label: 'Welcome', onClick: showWelcome, close: true },
  ].filter(Boolean);

  const setSearchFilter = createSearchFilter(table);

  const items = [
    {
      label: t('tournaments.new'),
      intent: 'is-success',
      onClick: () => (editTournament as any)({ table }),
      align: RIGHT,
    },
    { label: 'Actions', options: actions, align: RIGHT },
    {
      onKeyDown: (e: KeyboardEvent) =>
        e.key === 'Backspace' && (e.target as HTMLInputElement).value.length === 1 && setSearchFilter(''),
      onChange: (e: Event) => setSearchFilter((e.target as HTMLInputElement).value),
      onKeyUp: (e: Event) => setSearchFilter((e.target as HTMLInputElement).value),
      clearSearch: () => setSearchFilter(''),
      placeholder: 'Search tournaments',
      id: 'tournamentSearch',
      location: LEFT,
      search: true,
    },
  ];

  const target = document.getElementById(TOURNAMENTS_CONTROL) || undefined;
  controlBar({ target, items });
}
