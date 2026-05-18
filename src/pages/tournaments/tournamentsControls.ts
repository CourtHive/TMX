/**
 * Tournaments page top strip (two rows):
 *
 *   Row 1 (banner):  [ Tournaments (N) ]   [ All | Upcoming | Live | Completed ]   [ Cards | Table ]
 *   Row 2 (controls): [ search ]                                  [ New ] [ Actions ] [ Sort ]
 *
 * Status filter, view-toggle, and search drive the {@link TournamentsView}
 * setters. Admin actions (import/fetch/load-by-id) operate on a
 * Tabulator-shaped shim that invokes a full reload after writes land in IDB.
 */

import { fetchTournamentDetailsModal } from 'components/modals/fetchTournamentDetails';
import { importTournaments } from '../../services/storage/importTournaments';
import { loadTournamentById } from 'components/modals/loadTournamentById';
import { mockTournaments, EXAMPLE_TOURNAMENT_CATALOG } from './mockTournaments';
import { editTournament } from 'components/drawers/editTournamentDrawer';
import { buildTournamentsHeader } from './buildTournamentsHeader';
import { renderWelcomeView } from 'pages/tournaments/welcomeView';
import { getLoginState } from 'services/authentication/loginState';
import { destroyTable } from 'pages/tournament/destroyTable';
import { listPicker } from 'components/modals/listPicker';
import { controlBar } from 'courthive-components';
import { TournamentsSortField } from './tournamentsViewState';
import { TournamentsView } from 'components/tables/tournamentsTable/createTournamentsTable';
import { context } from 'services/context';
import { t } from 'i18n';

// constants
import {
  LEFT,
  RIGHT,
  SUPER_ADMIN,
  TMX_TOURNAMENTS,
  TOURNAMENTS_CONTROL,
  TOURNAMENTS_TABLE
} from 'constants/tmxConstants';

const IS_SUCCESS = 'is-success';
const SEARCH_INPUT_ID = 'tournamentSearch';
const STRIP_CONTROLS_CLASS = 'tmx-tournaments-strip__controls';
const STRIP_WRAP_CLASS = 'tmx-tournaments-strip';

interface SortOption {
  field: TournamentsSortField;
  dir: 'asc' | 'desc';
  label: string;
}

const SORT_OPTIONS: SortOption[] = [
  { field: 'startDate', dir: 'desc', label: 'Date (newest first)' },
  { field: 'startDate', dir: 'asc', label: 'Date (oldest first)' },
  { field: 'tournamentName', dir: 'asc', label: 'Name (A → Z)' },
  { field: 'tournamentName', dir: 'desc', label: 'Name (Z → A)' },
  { field: 'participantCount', dir: 'desc', label: 'Players (most first)' }
];

function makeTableShim(reloadAll: () => void, ids: string[]): any {
  return {
    getData: () => ids.map((tournamentId) => ({ tournamentId })),
    addData: () => reloadAll(),
    updateOrAddData: () => reloadAll(),
    on: () => undefined,
    off: () => undefined
  };
}

function buildSortItem(view: TournamentsView): any {
  const current = view.getState();
  const activeLabel =
    SORT_OPTIONS.find((o) => o.field === current.sortField && o.dir === current.sortDir)?.label ?? 'Sort';
  return {
    label: activeLabel,
    options: SORT_OPTIONS.map((opt) => ({
      label: opt.label,
      onClick: () => view.setSort(opt.field, opt.dir)
    })),
    align: RIGHT
  };
}

function buildSearchItem(view: TournamentsView): any {
  return {
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Backspace' && (e.target as HTMLInputElement).value.length === 1) {
        view.setSearchQuery('');
      }
    },
    onChange: (e: Event) => view.setSearchQuery((e.target as HTMLInputElement).value),
    onKeyUp: (e: Event) => view.setSearchQuery((e.target as HTMLInputElement).value),
    clearSearch: () => view.setSearchQuery(''),
    placeholder: 'Search tournaments',
    id: SEARCH_INPUT_ID,
    location: LEFT,
    search: true
  };
}

function showWelcomeRedirect(reloadAll: () => void): void {
  destroyTable({ anchorId: TOURNAMENTS_TABLE });
  const controlEl = document.getElementById(TOURNAMENTS_CONTROL);
  if (controlEl) controlEl.innerHTML = '';
  const anchor = document.getElementById(TOURNAMENTS_TABLE);
  if (!anchor) return;
  const navigate = () => context.router?.navigate(`/${TMX_TOURNAMENTS}/${Date.now()}`);
  renderWelcomeView(anchor, {
    onGenerate: () => {
      const options = [{ label: 'All', value: -1 }, ...EXAMPLE_TOURNAMENT_CATALOG];
      listPicker({
        title: 'Example Tournaments',
        actionLabel: 'Generate',
        actionIntent: IS_SUCCESS,
        options,
        callback: ({ selection }: any) => {
          const value = selection?.selection?.value;
          const indices = value === -1 ? undefined : [value];
          mockTournaments(undefined, () => {
            navigate();
            reloadAll();
          }, indices);
        }
      });
    },
    onCreate: () => editTournament({ onCreated: () => { navigate(); reloadAll(); } }),
    onBack: navigate
  });
}

function buildAdminActions(reloadAll: () => void, tableShim: any): any[] {
  const state = getLoginState();
  const admin = state?.roles?.includes(SUPER_ADMIN);
  const fetch = state?.services?.includes('tournamentProfile');

  return [
    admin && { label: 'Import tournament', onClick: () => importTournaments({ table: tableShim }) },
    fetch && { label: 'Fetch tournament', onClick: () => fetchTournamentDetailsModal({ table: tableShim }) },
    admin && { label: 'Load by ID', onClick: () => loadTournamentById({ table: tableShim }) },
    admin && { label: 'Welcome', onClick: () => showWelcomeRedirect(reloadAll), close: true }
  ].filter(Boolean);
}

function buildExamplesItem(reloadAll: () => void, tableShim: any): any {
  return {
    label: 'Examples',
    intent: 'is-info',
    onClick: () => {
      const options = [{ label: 'All', value: -1 }, ...EXAMPLE_TOURNAMENT_CATALOG];
      listPicker({
        title: 'Example Tournaments',
        actionLabel: 'Generate',
        actionIntent: IS_SUCCESS,
        options,
        callback: ({ selection }: any) => {
          const value = selection?.selection?.value;
          const indices = value === -1 ? undefined : [value];
          mockTournaments(tableShim, reloadAll, indices);
        }
      });
    },
    align: RIGHT
  };
}

function ensureStripStructure(parent: HTMLElement, headerEl: HTMLElement): HTMLElement {
  while (parent.firstChild) parent.removeChild(parent.firstChild);
  const wrap = document.createElement('div');
  wrap.className = STRIP_WRAP_CLASS;
  wrap.appendChild(headerEl);

  const controlsAnchor = document.createElement('div');
  controlsAnchor.className = STRIP_CONTROLS_CLASS;
  wrap.appendChild(controlsAnchor);

  parent.appendChild(wrap);
  return controlsAnchor;
}

export function calendarControls(view: TournamentsView, reloadAll: () => void, rowIds: string[]): void {
  const state = getLoginState();
  const tableShim = makeTableShim(reloadAll, rowIds);
  const actions = buildAdminActions(reloadAll, tableShim);

  const headerHandle = buildTournamentsHeader({ view, initialCount: rowIds.length });

  const items = [
    buildSearchItem(view),
    {
      label: t('tournaments.new'),
      intent: IS_SUCCESS,
      onClick: () => (editTournament as any)({ onCreated: reloadAll }),
      align: RIGHT
    },
    !state && buildExamplesItem(reloadAll, tableShim),
    actions.length && { label: 'Actions', options: actions, align: RIGHT },
    buildSortItem(view)
  ].filter(Boolean);

  const parent = document.getElementById(TOURNAMENTS_CONTROL);
  if (!parent) return;

  const controlsAnchor = ensureStripStructure(parent, headerHandle.element);
  controlBar({ target: controlsAnchor, items });

  // Keep the title's count in sync with filter/search changes.
  view.subscribeCount((count) => headerHandle.setCount(count));
}
