/**
 * Schedule 2 Tab — new schedule page shell with view switcher.
 *
 * Renders a persistent header (date strip + view switcher) and swaps between
 * Grid view (courthive-components createSchedulePage) and Profile view
 * (courthive-components createSchedulingProfile). A placeholder Live Courts
 * strip sits between the header and the active view.
 *
 * Routes:
 *   /#/tournament/:id/schedule2/:date          → Grid view (default)
 *   /#/tournament/:id/schedule2/:date/grid      → Grid view
 *   /#/tournament/:id/schedule2/:date/profile   → Profile view
 */
import { getScheduleDateRange, resolveScheduleDate } from '../scheduleUtils';
import { confirmModal } from 'components/modals/baseModal/baseModal';
import { competitionEngine } from 'services/factory/engine';
import { context } from 'services/context';

import { renderGridView, destroyGridView, hasUnsavedGridChanges, setGridBulkMode, getGridBulkMode, getUnsavedGridChangeCount, searchGridCells, buildScheduleDates, refreshGridView, setGridActiveStripVisible, DEFAULT_MIN_COURT_GRID_ROWS } from './gridView';
import { SCHEDULE2_CONTAINER, SCHEDULE2_CONTROL, SCHEDULE2_TAB } from 'constants/tmxConstants';
import { renderProfileView, destroyProfileView } from './profileView';
import { openClearScheduleMenu } from './clearScheduleActions';
import { buildGridHeaderActions } from './gridHeaderActions';
import { buildSchedule2Header } from './schedule2Header';
import {
  syncTournamentContext,
  invalidateAllScheduleCaches,
  getCachedCompetitionDateRange,
  getCachedTournamentInfo,
} from './schedule2DataCache';
import {
  readScheduleDisplayConfig,
  writeScheduleDisplayConfig,
} from 'services/schedulePreferences/scheduleDisplayExtension';
export type Schedule2View = 'grid' | 'profile';

interface Schedule2State {
  currentView: Schedule2View;
  selectedDate: string;
}

// localStorage keys for cross-refresh persistence. We don't use the
// tmx_columns/context.columns helper because that store is hydrated
// inside setupTMX() — after this module's top-level code has already run.
// Grid and profile have INDEPENDENT catalog visibility — they're
// different user journeys (matchUp catalog vs round catalog) and a user
// hiding one shouldn't hide the other.
const GRID_CATALOG_VISIBILITY_KEY = 'schedule2:catalog:grid';
const PROFILE_CATALOG_VISIBILITY_KEY = 'schedule2:catalog:profile';
const ACTIVE_STRIP_VISIBILITY_KEY = 'schedule2:activeStrip';
const SELECTED_DATE_KEY = 'schedule2:selectedDate';
// Tournament-stamped view persistence: stays valid as long as the user is
// inside the same tournament; flipping to a different tournament resets the
// remembered choice back to the grid default.
const SCHEDULE_VIEW_KEY = 'schedule2:scheduleView';

function readBoolFlag(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return stored !== 'false';
  } catch {
    return fallback;
  }
}

function writeBoolFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // storage unavailable
  }
}

function readGridCatalogVisible(): boolean {
  return readBoolFlag(GRID_CATALOG_VISIBILITY_KEY, true);
}

function writeGridCatalogVisible(visible: boolean): void {
  writeBoolFlag(GRID_CATALOG_VISIBILITY_KEY, visible);
}

function readProfileCatalogVisible(): boolean {
  return readBoolFlag(PROFILE_CATALOG_VISIBILITY_KEY, true);
}

function writeProfileCatalogVisible(visible: boolean): void {
  writeBoolFlag(PROFILE_CATALOG_VISIBILITY_KEY, visible);
}

function readActiveStripVisible(): boolean {
  return readBoolFlag(ACTIVE_STRIP_VISIBILITY_KEY, true);
}

function writeActiveStripVisible(visible: boolean): void {
  writeBoolFlag(ACTIVE_STRIP_VISIBILITY_KEY, visible);
}

function readPersistedDate(): string | null {
  try {
    return localStorage.getItem(SELECTED_DATE_KEY);
  } catch {
    return null;
  }
}

function writePersistedDate(date: string): void {
  try {
    localStorage.setItem(SELECTED_DATE_KEY, date);
  } catch {
    // storage unavailable
  }
}

/**
 * Read the user's last-chosen schedule view, but only honor it for the same
 * tournament. Switching to a different tournament clears the stored entry so
 * the next visit gets a fresh grid default.
 */
function readPersistedView(tournamentId: string): Schedule2View | null {
  try {
    const raw = localStorage.getItem(SCHEDULE_VIEW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { tournamentId?: string; view?: Schedule2View };
    if (parsed?.tournamentId === tournamentId && (parsed.view === 'profile' || parsed.view === 'grid')) {
      return parsed.view;
    }
    localStorage.removeItem(SCHEDULE_VIEW_KEY);
    return null;
  } catch {
    return null;
  }
}

function writePersistedView(tournamentId: string, view: Schedule2View): void {
  try {
    localStorage.setItem(SCHEDULE_VIEW_KEY, JSON.stringify({ tournamentId, view }));
  } catch {
    // storage unavailable
  }
}

// Shared layout selectors / class names — used by the per-view catalog
// visibility appliers and the post-render initial-collapse pass.
const LAYOUT_SEL = '.spl-layout, .sp-layout';
const COLLAPSED_CLASS = 'spl-sidebar-collapsed';

let state: Schedule2State | null = null;
let gridCatalogVisible: boolean | undefined;
let profileCatalogVisible: boolean | undefined;
let activeStripVisible: boolean | undefined;
export function renderSchedule2Tab(params: { scheduledDate?: string; scheduleView?: string }): void {
  // Tournament-context check FIRST — must precede any cached read so a
  // cross-tournament navigation drops the prior cache before we serve
  // anyone stale data. getTournamentInfo here bypasses the cache by
  // design (it's the discriminator that decides whether to invalidate).
  const liveTournamentId = competitionEngine.getTournamentInfo().tournamentInfo?.tournamentId ?? '';
  syncTournamentContext(liveTournamentId);

  const { startDate, endDate } = getCachedCompetitionDateRange();

  gridCatalogVisible ??= readGridCatalogVisible();
  profileCatalogVisible ??= readProfileCatalogVisible();
  activeStripVisible ??= readActiveStripVisible();

  // Resolve date — redirect if missing. Prefer the user's last-selected date
  // (when still inside this tournament's date range) over today's fallback so
  // navigating in from the nav bar lands where the user left off.
  if (!params.scheduledDate) {
    const persistedDate = readPersistedDate();
    const validDates = getScheduleDateRange();
    const scheduledDate = persistedDate && validDates.includes(persistedDate) ? persistedDate : resolveScheduleDate();
    context.router?.navigate(`/tournament/${liveTournamentId}/${SCHEDULE2_TAB}/${scheduledDate}`);
    return;
  }

  const scheduledDate = params.scheduledDate || resolveScheduleDate();
  // Resolve view in priority order:
  //   1. URL param (`/schedule2/:date/profile|grid`) — explicit and wins
  //   2. Tournament-stamped persistence — last choice within this tournament
  //   3. Grid — default for first-time entry or after switching tournaments
  const tournamentId = liveTournamentId;
  const explicitView: Schedule2View | null =
    params.scheduleView === 'profile' || params.scheduleView === 'grid' ? params.scheduleView : null;
  const view: Schedule2View = explicitView ?? readPersistedView(tournamentId) ?? 'grid';

  // Store selected date for other parts of TMX + persist for next visit
  context.displayed.selectedScheduleDate = scheduledDate;
  writePersistedDate(scheduledDate);
  if (tournamentId) writePersistedView(tournamentId, view);

  const controlAnchor = document.getElementById(SCHEDULE2_CONTROL)!;
  const container = document.getElementById(SCHEDULE2_CONTAINER)!;

  // Clear previous content
  controlAnchor.innerHTML = '';
  destroyCurrentView();
  container.innerHTML = '';

  state = { currentView: view, selectedDate: scheduledDate };

  // Per-view visibility togglers. Grid and profile have independent catalog
  // state — hiding one must NOT hide the other. The DOM operation is the
  // same in both cases (toggle .spl-sidebar-collapsed on whichever layout
  // the active view rendered) since only one view is mounted at a time.
  function applyGridCatalogVisible(next: boolean): void {
    gridCatalogVisible = next;
    writeGridCatalogVisible(next);
    const layout = container.querySelector(LAYOUT_SEL) as HTMLElement | null;
    if (layout) layout.classList.toggle(COLLAPSED_CLASS, !next);
  }
  function applyProfileCatalogVisible(next: boolean): void {
    profileCatalogVisible = next;
    writeProfileCatalogVisible(next);
    const layout = container.querySelector(LAYOUT_SEL) as HTMLElement | null;
    if (layout) layout.classList.toggle(COLLAPSED_CLASS, !next);
  }
  function applyActiveStripVisible(next: boolean): void {
    activeStripVisible = next;
    writeActiveStripVisible(next);
    setGridActiveStripVisible(next);
  }

  // Build header with rich date dropdown + issues icon + view switcher.
  // Catalog/strip/Rows/print live in the court grid header — see
  // gridHeaderActions.ts and the headerActions slot in courthive-components.
  // Tournament-scoped minRows overrides the hardcoded default so all
  // directors on a tournament see the same grid density once anyone has
  // nudged the Rows stepper.
  const scheduleDisplayConfig = readScheduleDisplayConfig();
  const extensionMinRows = scheduleDisplayConfig.minCourtGridRows;
  const effectiveMinRows = extensionMinRows ?? DEFAULT_MIN_COURT_GRID_ROWS;

  const header = buildSchedule2Header({
    selectedDate: scheduledDate,
    activeView: view,
    startDate: startDate ?? '',
    endDate: endDate ?? '',
    scheduleDates: buildScheduleDates(scheduledDate),
    onDateChange: (date: string) => {
      guardUnsavedAndProceed(() => {
        const tid = getCachedTournamentInfo()?.tournamentInfo?.tournamentId;
        context.router?.navigate(`/tournament/${tid}/${SCHEDULE2_TAB}/${date}/${state?.currentView || 'grid'}`);
      });
    },
    onViewChange: (newView: Schedule2View) => {
      guardUnsavedAndProceed(() => {
        const tid = getCachedTournamentInfo()?.tournamentInfo?.tournamentId;
        context.router?.navigate(`/tournament/${tid}/${SCHEDULE2_TAB}/${scheduledDate}/${newView}`);
      });
    },
  });
  controlAnchor.appendChild(header);

  // Render the active view
  if (view === 'profile') {
    renderProfileView(container, scheduledDate, {
      catalogVisible: profileCatalogVisible ?? true,
      onToggleCatalog: applyProfileCatalogVisible,
    });
    // Profile view is configuration, not live data — let the sync indicator handle remote mutations
    context.refreshActiveTable = undefined;
  } else {
    // Inject the strip/print icons into the right-aligned header slot, and the
    // catalog toggle into the leading slot so it sits next to "Court Grid" —
    // co-located with the catalog it controls (left column).
    const gridActions = buildGridHeaderActions({
      selectedDate: scheduledDate,
      bulkMode: getGridBulkMode(),
      catalogVisible: gridCatalogVisible ?? true,
      activeStripVisible: activeStripVisible ?? true,
      startOnDrop: scheduleDisplayConfig.startOnDrop ?? false,
      minRows: effectiveMinRows,
      onToggleCatalog: applyGridCatalogVisible,
      onToggleActiveStrip: applyActiveStripVisible,
      onToggleStartOnDrop: (enabled: boolean) => {
        // Toggling counts as answering the one-time prompt, so it won't fire later.
        writeScheduleDisplayConfig({ startOnDrop: enabled, startOnDropPrompted: true });
      },
      onMinRowsChange: (rows: number) => {
        writeScheduleDisplayConfig({ minCourtGridRows: rows });
        refreshGridView();
      },
      onSearch: (text) => searchGridCells(text),
    });
    renderGridView(container, scheduledDate, {
      headerActions: gridActions.trailing,
      titleLeadingActions: gridActions.leading,
      titleSlot: gridActions.titleSlot,
      activeStripVisible,
      bulkMode: getGridBulkMode(),
      onBulkModeChange: (enabled: boolean) => {
        // Turning off bulk mode with pending changes needs an explicit
        // "discard?" confirmation. Themed cModal — never native dialog.
        if (!enabled && hasUnsavedGridChanges()) {
          const count = getUnsavedGridChangeCount();
          confirmModal({
            title: 'Discard unsaved changes?',
            query: `You have ${count} unsaved scheduling change(s). Switching to immediate mode will discard them. Continue?`,
            okIntent: 'is-warning',
            okAction: () => {
              setGridBulkMode(enabled);
              // Toggle now matches state; no re-render needed.
            },
            cancelAction: () => {
              // Bounce the toggle visual back to its previous state.
              controlAnchor.innerHTML = '';
              renderSchedule2Tab(params);
            },
          });
          return;
        }
        setGridBulkMode(enabled);
      },
      onClearSchedule: (target) =>
        openClearScheduleMenu({
          target,
          scheduledDate,
          onCleared: () => refreshGridView(),
        }),
    });
    // Wire remote-mutation refresh so cells update when other clients schedule matchUps
    context.refreshActiveTable = refreshGridView;
  }

  // Apply persisted catalog visibility to the freshly rendered layout —
  // use the value for the active view only, since each view tracks
  // catalog visibility independently.
  const currentCatalogVisible = view === 'profile' ? profileCatalogVisible : gridCatalogVisible;
  if (!currentCatalogVisible) {
    const layout = container.querySelector(LAYOUT_SEL) as HTMLElement | null;
    if (layout) layout.classList.add(COLLAPSED_CLASS);
  }
}

function destroyCurrentView(): void {
  if (!state) return;
  if (state.currentView === 'grid') destroyGridView();
  if (state.currentView === 'profile') destroyProfileView();
}

// Public tear-down for tab navigation. Mirrors destroySchedulingTab in
// schedulingTab.ts. Without this, the activeStripBlockTicker (30s setInterval)
// in gridView.ts plus the store subscribers keep firing after the user
// navigates to a different tab — visible as ongoing competitionScheduleMatchUps
// devContext logs from a tab the user is no longer on.
export function destroySchedule2Tab(): void {
  destroyCurrentView();
  state = null;
  // Tab is leaving the screen — drop every cached factory result so the
  // next mount of schedule2 (which may target a different tournament or
  // arrive after external mutations) starts from a clean slate.
  invalidateAllScheduleCaches();
}

/**
 * Run `proceed` once the user has acknowledged any unsaved bulk scheduling
 * changes. When the grid is clean we fire synchronously (preserves the
 * common navigation path); when dirty we open a themed cModal — the proceed
 * callback runs on the Ok button, and Cancel / click-outside leaves the
 * grid untouched. NEVER reach for window.confirm here.
 */
function guardUnsavedAndProceed(proceed: () => void): void {
  if (!hasUnsavedGridChanges()) {
    proceed();
    return;
  }
  confirmModal({
    title: 'Discard unsaved changes?',
    query: 'You have unsaved scheduling changes. Discard and continue?',
    okIntent: 'is-warning',
    okAction: () => proceed(),
  });
}

/** Exported for use by router guards or other navigation checks. */
export function hasUnsavedScheduleChanges(): boolean {
  return hasUnsavedGridChanges();
}

// ── beforeunload guard ──
function onBeforeUnload(e: BeforeUnloadEvent): void {
  if (hasUnsavedGridChanges()) {
    e.preventDefault();
  }
}

window.addEventListener('beforeunload', onBeforeUnload);
