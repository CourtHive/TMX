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

import { currentSessionScope, sessionScopeUnchanged } from 'services/authentication/sessionScope';
import { renderTournamentsGrid, renderTournamentsSkeleton } from 'pages/tournaments/createTournamentsGrid';
import { mockTournaments, EXAMPLE_TOURNAMENT_CATALOG } from 'pages/tournaments/mockTournaments';
import { createOnlineSearchController } from 'pages/tournaments/onlineSearchController';
import { searchRowToTournamentRow } from 'pages/tournaments/searchRowToTournamentRow';
import { mapTournamentRecord, TournamentRow } from 'pages/tournaments/mapTournamentRecord';
import { searchTournaments } from 'services/apis/searchTournaments';
import { calendarControls } from 'pages/tournaments/tournamentsControls';
import { editTournament } from 'components/drawers/editTournamentDrawer';
import { getUserContext } from 'services/authentication/getUserContext';
import { fetchMyCalendars, type MyCalendarsResult } from 'services/apis/fetchMyCalendars';
import { fetchPublicCalendar, type PublicCalendarResult } from 'services/apis/fetchPublicCalendar';
import { getLoginState } from 'services/authentication/loginState';
import { renderWelcomeView } from 'pages/tournaments/welcomeView';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTipster } from 'components/popovers/tipster';
import { tmxToast } from 'services/notifications/tmxToast';
import { destroyTable } from 'pages/tournament/destroyTable';
import { getTournamentColumns } from './getTournamentColumn';
import { listPicker } from 'components/modals/listPicker';
import { displayConfig } from 'config/displayConfig';
import { readLocalCalendarEntries } from 'services/storage/localCalendar';
import { context } from 'services/context';
import { filterTournaments, sortTournaments } from 'pages/tournaments/tournamentsFilter';
import {
  initialTournamentsViewState,
  persistViewMode,
  TournamentsSortField,
  TournamentsStatusFilter,
  TournamentsViewMode,
  TournamentsViewState,
} from 'pages/tournaments/tournamentsViewState';

// constants
import { TOURNAMENTS_CONTROL, TOURNAMENTS_TABLE } from 'constants/tmxConstants';
import { t } from 'i18n';

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
  /**
   * Render a SERVER result set in place of the loaded rows, reporting the server's own total.
   * `total` is the honest denominator: it can exceed what was rendered, and saying so is the
   * whole point of searching the corpus instead of the page.
   */
  setRows(rows: TournamentRow[], total: number): void;
  /** Back to the rows the calendar walk loaded, filtered locally as before. */
  restoreRows(): void;
  /** Fires on every search-box change, so an online search can be driven from it. */
  subscribeQuery(listener: (query: string) => void): void;
}

const IS_SUCCESS = 'is-success';
const IS_WARNING = 'is-warning';

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
      const options = [{ label: t('tournamentsControls.all'), value: -1 }, ...EXAMPLE_TOURNAMENT_CATALOG];
      listPicker({
        title: t('tournamentsControls.exampleTournaments'),
        actionLabel: 'Generate',
        actionIntent: IS_SUCCESS,
        options,
        callback: ({ selection }: any) => {
          const value = selection?.selection?.value;
          const indices = value === -1 ? undefined : [value];
          mockTournaments(undefined, onCreated, indices);
        },
      });
    },
    onCreate: () => editTournament({ onCreated }),
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
      r === imageResource ? { ...r, url: r.identifier } : r,
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
    placeholder: t('ui.noTournaments'),
    layout: 'fitColumns',
    index: 'tournamentId',
    headerVisible: true,
    reactiveData: false,
    data: rows,
    columns: getTournamentColumns(),
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
  /** True when `rows` came from the search endpoint rather than the calendar walk. */
  serverActive?: boolean;
}

function applyView({ anchor, rows, state, serverActive }: RenderInput): number {
  // The server ALREADY applied the text query, across the whole published corpus. Re-applying it
  // here would re-filter the answer against the local haystack and silently drop hits whose match
  // the client cannot see. The status filter still applies: it is not part of the query.
  const filtered = filterTournaments(rows, state.statusFilter, serverActive ? '' : state.searchQuery);
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
  const queryListeners: Array<(query: string) => void> = [];
  const localRows = rows;
  let activeRows = rows;
  /** Set only while a SERVER result set is on screen; carries the total the server reported. */
  let serverTotal: number | undefined;
  let lastCount = 0;
  const rerender = () => {
    lastCount = applyView({ anchor, rows: activeRows, state, serverActive: serverTotal !== undefined });
    // With server results the banner reports the SERVER's total, which may exceed what is
    // rendered. The rendered length would be the same comfortable lie the old client-side
    // filter told.
    const reported = serverTotal ?? lastCount;
    for (const cb of countListeners) cb(reported);
  };

  return {
    getState: () => ({ ...state }),
    setSearchQuery: (q) => {
      state.searchQuery = q;
      // Filter what is loaded immediately — instant, and the only answer available offline — then
      // let the online search replace it when the server answers.
      rerender();
      for (const cb of queryListeners) cb(q);
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
      cb(serverTotal ?? lastCount);
    },
    setRows: (next, total) => {
      activeRows = next;
      serverTotal = total;
      rerender();
    },
    restoreRows: () => {
      activeRows = localRows;
      serverTotal = undefined;
      rerender();
    },
    subscribeQuery: (cb) => queryListeners.push(cb),
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
  // Read maintained lightweight calendar entries rather than loading every full
  // tournament record. Same shape as the server calendar, so it flows through
  // the shared fromCalendarTournaments mapper.
  return readLocalCalendarEntries().then(
    (entries: any[]) => fromCalendarTournaments(anchor, [{ tournaments: entries }], onCreated),
    () => renderRows(anchor, [], onCreated),
  );
}

function fromCalendarTournaments(anchor: HTMLElement, calendars: any[], onCreated: () => void): TournamentsView {
  const tournaments = flattenCalendars(calendars);
  const rows = tournaments.map(mapTournamentRecord);
  return renderRows(anchor, rows, onCreated);
}

function fromMyCalendars(
  anchor: HTMLElement,
  result: MyCalendarsResult,
  fallback: () => Promise<TournamentsView>,
  onCreated: () => void,
): Promise<TournamentsView> | TournamentsView {
  const calendars = result?.calendars;
  if (!calendars?.length) return fallback();
  const tournaments = flattenCalendars(calendars);
  if (tournaments.length === 0) return fallback();
  // The page walk stopped before the server ran out. Say so — a list that is
  // quietly missing rows is worse than a short one the user knows is short.
  if (result.truncated) {
    tmxToast({
      intent: IS_WARNING,
      message: t('toasts.tournamentsTruncated', { loaded: result.loaded, total: result.total }),
    });
  }
  return fromCalendarTournaments(anchor, calendars, onCreated);
}

/**
 * Point the search box at the SEARCH ENDPOINT instead of the rows already loaded.
 *
 * Only on the PUBLIC path, and deliberately: the authenticated list is read from CFS because a
 * director must see their own writes, and the projection feeding this endpoint is asynchronous.
 *
 * Scoped to the provider whose calendar is on screen — `organisationId`, which the calendar
 * response carries, NOT the abbreviation the URL uses. Searching a provider's listing must stay
 * inside that provider; the endpoint would happily search all 49,749 published tournaments.
 */
function attachOnlineSearch(view: TournamentsView, providerId?: string): void {
  if (!providerId) return; // no id, no scope — leave the local filter alone rather than widen it
  const controller = createOnlineSearchController({
    search: (query) => searchTournaments({ q: query, providerId }),
    onResults: (result) => view.setRows(result.tournaments.map(searchRowToTournamentRow), result.total),
    onLocal: () => view.restoreRows(),
    onError: () => {
      // Say the search failed. Falling back silently would render the local subset under a
      // count the user reads as the whole corpus — the exact lie this work removes.
      tmxToast({ intent: IS_WARNING, message: t('toasts.tournamentSearchFailed') });
      view.restoreRows();
    },
  });
  view.subscribeQuery((query) => controller.setQuery(query));
}

function fromPublicCalendar(
  anchor: HTMLElement,
  result: PublicCalendarResult,
  fallback: () => Promise<TournamentsView>,
  onCreated: () => void,
): Promise<TournamentsView> | TournamentsView {
  const calendar = result?.calendar;
  if (!calendar) return fallback();
  // The page walk stopped before the server ran out. Say so — a list quietly missing rows is
  // worse than a short one the user knows is short.
  if (result.truncated) {
    tmxToast({
      intent: IS_WARNING,
      message: t('toasts.tournamentsTruncated', { loaded: calendar.tournaments.length, total: result.total }),
    });
  }
  const view = fromCalendarTournaments(anchor, [calendar], onCreated);
  attachOnlineSearch(view, calendar.provider?.organisationId);
  return view;
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
    // Capture who is asking. The calendar walk is the longest read on this page,
    // and on 2026-09-15 one of them resolved after the user had stopped
    // impersonating AND logged out — painting 49,000+ provider tournaments into
    // a logged-out browser. A response that outlives its session is discarded;
    // whatever changed the session has already queued its own render.
    const scope = currentSessionScope();
    ready = fetchMyCalendars(impersonatedAbbr ? { providerAbbr: impersonatedAbbr } : {}).then(
      (result: MyCalendarsResult) =>
        sessionScopeUnchanged(scope)
          ? Promise.resolve(fromMyCalendars(anchor, result, fallback, onCreated))
          : undefined,
      () => (sessionScopeUnchanged(scope) ? fallback() : undefined),
    );
  } else if (provider?.organisationAbbreviation) {
    // Paged, like the authenticated path above: a single request returns at most the
    // server's default page, which silently truncated providers larger than that.
    ready = fetchPublicCalendar({ providerAbbr: provider.organisationAbbreviation }).then(
      (result: PublicCalendarResult) => Promise.resolve(fromPublicCalendar(anchor, result, fallback, onCreated)),
      () => fallback(),
    );
  } else {
    ready = fallback();
  }

  return { ready };
}
