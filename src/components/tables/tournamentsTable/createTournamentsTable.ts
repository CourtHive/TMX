/**
 * Tournaments page orchestrator.
 *
 * Reads the data cascade (server calendar -> public calendar -> IndexedDB),
 * normalizes each tournament via the shared mapper, applies filter+sort, and
 * renders either a card grid (default) or a Tabulator table (toggle).
 *
 * Exposes a `TournamentsView` to the control bar so chips, sort, search, and
 * the view toggle can drive re-renders without owning render state.
 */

import {
  filterTournaments,
  sortTournaments
} from 'pages/tournaments/tournamentsFilter';
import { renderTournamentsGrid, renderTournamentsSkeleton } from 'pages/tournaments/createTournamentsGrid';
import {
  initialTournamentsViewState,
  persistViewMode,
  TournamentsSortField,
  TournamentsStatusFilter,
  TournamentsViewMode,
  TournamentsViewState
} from 'pages/tournaments/tournamentsViewState';
import { mapTournamentRecord, TournamentRow } from 'pages/tournaments/mapTournamentRecord';
import { calendarControls } from 'pages/tournaments/tournamentsControls';
import { getUserContext } from 'services/authentication/getUserContext';
import { getCalendar, getMyCalendars } from 'services/apis/servicesApi';
import { renderWelcomeView } from 'pages/tournaments/welcomeView';
import { editTournament } from 'components/drawers/editTournamentDrawer';
import { mockTournaments, EXAMPLE_TOURNAMENT_CATALOG } from 'pages/tournaments/mockTournaments';
import { getLoginState } from 'services/authentication/loginState';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTipster } from 'components/popovers/tipster';
import { destroyTable } from 'pages/tournament/destroyTable';
import { listPicker } from 'components/modals/listPicker';
import { getTournamentColumns } from './getTournamentColumn';
import { tmx2db } from 'services/storage/tmx2db';
import { displayConfig } from 'config/displayConfig';
import { context } from 'services/context';

// constants
import { TOURNAMENTS_CONTROL, TOURNAMENTS_TABLE } from 'constants/tmxConstants';

export interface TournamentsView {
  getState(): TournamentsViewState;
  setSearchQuery(q: string): void;
  setStatusFilter(s: TournamentsStatusFilter): void;
  setSort(field: TournamentsSortField, dir: 'asc' | 'desc'): void;
  setViewMode(mode: TournamentsViewMode): void;
  refresh(): void;
  /** Subscribe to filtered-row count (fires on every refresh + immediately
   * with the current count). Used by the banner header to keep its title in
   * sync with what's actually visible. */
  subscribeCount(listener: (count: number) => void): void;
}

const IS_SUCCESS = 'is-success';

function getAnchor(): HTMLElement | null {
  return document.getElementById(TOURNAMENTS_TABLE);
}

function clearControl(): void {
  const controlEl = document.getElementById(TOURNAMENTS_CONTROL);
  if (controlEl) controlEl.innerHTML = '';
}

function clearAnchor(anchor: HTMLElement): void {
  destroyTable({ anchorId: TOURNAMENTS_TABLE });
  while (anchor.firstChild) anchor.removeChild(anchor.firstChild);
}

function showWelcome(anchor: HTMLElement, onCreated: () => void): void {
  clearAnchor(anchor);
  clearControl();
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
          mockTournaments(undefined, onCreated, indices);
        }
      });
    },
    onCreate: () => editTournament({ onCreated })
  });
}

function isTournamentImage({ name }: any): boolean {
  return name === 'tournamentImage';
}

function decorateCalendarTournament(t: any): any {
  const inner = t.tournament;
  if (!inner) return t;
  inner.offline = inner.timeItemValues?.TMX?.offline;
  const imageResource = inner.onlineResources?.find(isTournamentImage);
  // Calendar API returns `identifier` for both URL and COURT_SVG;
  // the shared mapper expects `url` for URL resources.
  if (imageResource?.resourceType === 'URL') {
    inner.onlineResources = inner.onlineResources.map((r: any) =>
      r === imageResource ? { ...r, url: r.identifier } : r
    );
  }
  // Calendar entries carry tournamentId at the wrapper level. Coalesce it
  // onto the inner record so the shared mapper sees it.
  if (!inner.tournamentId && t.tournamentId) inner.tournamentId = t.tournamentId;
  return inner;
}

function flattenCalendars(calendars: any[]): any[] {
  const tournaments: any[] = [];
  for (const cal of calendars) {
    for (const t of cal.tournaments ?? []) tournaments.push(decorateCalendarTournament(t));
  }
  return tournaments;
}

function renderTable(anchor: HTMLElement, rows: TournamentRow[]): any {
  clearAnchor(anchor);
  const table = new Tabulator(anchor, {
    height: globalThis.innerHeight * (displayConfig.get().tableHeightMultiplier ?? 0.85),
    placeholder: 'No tournaments',
    layout: 'fitColumns',
    index: 'tournamentId',
    headerVisible: true,
    reactiveData: false,
    data: rows,
    columns: getTournamentColumns()
  });
  table.on('scrollVertical', destroyTipster);
  return table;
}

function renderEmpty(anchor: HTMLElement): void {
  clearAnchor(anchor);
  // Placeholder; welcome view is invoked separately when there is no data at all.
}

interface RenderInput {
  anchor: HTMLElement;
  rows: TournamentRow[];
  state: TournamentsViewState;
}

function applyView({ anchor, rows, state }: RenderInput): number {
  const filtered = filterTournaments(rows, state.statusFilter, state.searchQuery);
  const sorted = sortTournaments(filtered, state.sortField, state.sortDir);

  if (state.viewMode === 'grid') {
    const empty =
      state.searchQuery || state.statusFilter !== 'all'
        ? 'No tournaments match the current filters.'
        : 'No tournaments yet.';
    renderTournamentsGrid(anchor, sorted, empty);
    return sorted.length;
  }

  if (sorted.length === 0) {
    renderEmpty(anchor);
    return 0;
  }
  renderTable(anchor, sorted);
  return sorted.length;
}

function createView(anchor: HTMLElement, rows: TournamentRow[]): TournamentsView {
  const state = initialTournamentsViewState();
  const countListeners: Array<(count: number) => void> = [];
  let lastCount = 0;
  const rerender = () => {
    lastCount = applyView({ anchor, rows, state });
    for (const cb of countListeners) cb(lastCount);
  };

  return {
    getState: () => ({ ...state }),
    setSearchQuery: (q) => {
      state.searchQuery = q;
      rerender();
    },
    setStatusFilter: (s) => {
      state.statusFilter = s;
      rerender();
    },
    setSort: (field, dir) => {
      state.sortField = field;
      state.sortDir = dir;
      rerender();
    },
    setViewMode: (mode) => {
      state.viewMode = mode;
      persistViewMode(mode);
      rerender();
    },
    refresh: rerender,
    subscribeCount: (cb) => {
      countListeners.push(cb);
      cb(lastCount);
    }
  };
}

function renderRows(anchor: HTMLElement, rows: TournamentRow[], onCreated: () => void): TournamentsView {
  if (rows.length === 0) {
    showWelcome(anchor, onCreated);
    return createView(anchor, []);
  }
  const view = createView(anchor, rows);
  view.refresh();
  const rowIds = rows.map((r) => r.tournamentId);
  calendarControls(view, onCreated, rowIds);
  return view;
}

function fromLocalDb(anchor: HTMLElement, onCreated: () => void): Promise<TournamentsView> {
  return tmx2db.findAllTournaments().then(
    (data: any[]) => renderRows(anchor, data.map(mapTournamentRecord), onCreated),
    () => renderRows(anchor, [], onCreated)
  );
}

function fromCalendarTournaments(anchor: HTMLElement, calendars: any[], onCreated: () => void): TournamentsView {
  const tournaments = flattenCalendars(calendars);
  const rows = tournaments.map(mapTournamentRecord);
  return renderRows(anchor, rows, onCreated);
}

function fromMyCalendars(
  anchor: HTMLElement,
  result: any,
  fallback: () => Promise<TournamentsView>,
  onCreated: () => void
): Promise<TournamentsView> | TournamentsView {
  const calendars = result?.data?.calendars;
  if (!calendars?.length) return fallback();
  const tournaments = flattenCalendars(calendars);
  if (tournaments.length === 0) return fallback();
  return fromCalendarTournaments(anchor, calendars, onCreated);
}

function fromPublicCalendar(
  anchor: HTMLElement,
  result: any,
  fallback: () => Promise<TournamentsView>,
  onCreated: () => void
): Promise<TournamentsView> | TournamentsView {
  const calendar = result?.data?.calendar;
  if (!calendar) return fallback();
  return fromCalendarTournaments(anchor, [calendar], onCreated);
}

export function createTournamentsTable(): { ready: Promise<TournamentsView | undefined> } {
  const dnav = document.getElementById('dnav');
  if (dnav) dnav.style.backgroundColor = '';

  const anchor = getAnchor();
  if (!anchor) return { ready: Promise.resolve(undefined) };

  renderTournamentsSkeleton(anchor);

  const loginState = getLoginState();
  const provider = context?.provider || loginState?.provider;
  const impersonatedAbbr = context?.provider?.organisationAbbreviation;
  const userContext = getUserContext();

  const onCreated = () => createTournamentsTable();
  const fallback = () => fromLocalDb(anchor, onCreated);

  let ready: Promise<TournamentsView | undefined>;

  if (userContext) {
    ready = getMyCalendars(impersonatedAbbr ? { providerAbbr: impersonatedAbbr } : {}).then(
      (result: any) => Promise.resolve(fromMyCalendars(anchor, result, fallback, onCreated)),
      () => fallback()
    );
  } else if (provider?.organisationAbbreviation) {
    ready = getCalendar({ providerAbbr: provider.organisationAbbreviation }).then(
      (result: any) => Promise.resolve(fromPublicCalendar(anchor, result, fallback, onCreated)),
      () => fallback()
    );
  } else {
    ready = fallback();
  }

  return { ready };
}
