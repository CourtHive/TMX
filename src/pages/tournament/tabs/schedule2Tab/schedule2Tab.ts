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
import { competitionEngine } from 'tods-competition-factory';
import { getScheduleDateRange, resolveScheduleDate } from '../scheduleUtils';
import { context } from 'services/context';

import { SCHEDULE2_CONTAINER, SCHEDULE2_CONTROL, SCHEDULE2_TAB } from 'constants/tmxConstants';
import { buildSchedule2Header } from './schedule2Header';
import { renderGridView, destroyGridView, hasUnsavedGridChanges, setGridBulkMode, getGridBulkMode, searchGridCells, buildScheduleDates, buildIssues, refreshGridView } from './gridView';
import { renderProfileView, destroyProfileView } from './profileView';
import { openClearScheduleMenu } from './clearScheduleActions';

export type Schedule2View = 'grid' | 'profile';

interface Schedule2State {
  currentView: Schedule2View;
  selectedDate: string;
}

// localStorage keys for cross-refresh persistence. We don't use the
// tmx_columns/context.columns helper because that store is hydrated
// inside setupTMX() — after this module's top-level code has already run.
const CATALOG_VISIBILITY_KEY = 'schedule2:catalog';
const SELECTED_DATE_KEY = 'schedule2:selectedDate';

function readCatalogVisible(): boolean {
  try {
    const stored = localStorage.getItem(CATALOG_VISIBILITY_KEY);
    return stored === null ? true : stored !== 'false';
  } catch {
    return true;
  }
}

function writeCatalogVisible(visible: boolean): void {
  try {
    localStorage.setItem(CATALOG_VISIBILITY_KEY, String(visible));
  } catch {
    // storage unavailable
  }
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

let state: Schedule2State | null = null;
let catalogVisible: boolean | undefined;

export function renderSchedule2Tab(params: { scheduledDate?: string; scheduleView?: string }): void {
  const { startDate, endDate } = competitionEngine.getCompetitionDateRange();

  catalogVisible ??= readCatalogVisible();

  // Resolve date — redirect if missing. Prefer the user's last-selected date
  // (when still inside this tournament's date range) over today's fallback so
  // navigating in from the nav bar lands where the user left off.
  if (!params.scheduledDate) {
    const persistedDate = readPersistedDate();
    const validDates = getScheduleDateRange();
    const scheduledDate = persistedDate && validDates.includes(persistedDate) ? persistedDate : resolveScheduleDate();
    const tournamentId = competitionEngine.getTournamentInfo().tournamentInfo?.tournamentId;
    context.router?.navigate(`/tournament/${tournamentId}/${SCHEDULE2_TAB}/${scheduledDate}`);
    return;
  }

  const scheduledDate = params.scheduledDate || resolveScheduleDate();
  const view: Schedule2View = params.scheduleView === 'profile' ? 'profile' : 'grid';

  // Store selected date for other parts of TMX + persist for next visit
  context.displayed.selectedScheduleDate = scheduledDate;
  writePersistedDate(scheduledDate);

  const controlAnchor = document.getElementById(SCHEDULE2_CONTROL)!;
  const container = document.getElementById(SCHEDULE2_CONTAINER)!;

  // Clear previous content
  controlAnchor.innerHTML = '';
  destroyCurrentView();
  container.innerHTML = '';

  state = { currentView: view, selectedDate: scheduledDate };

  // Build header with rich date dropdown + issues icon + catalog toggle + view switcher
  const header = buildSchedule2Header({
    selectedDate: scheduledDate,
    activeView: view,
    startDate,
    endDate,
    bulkMode: getGridBulkMode(),
    catalogVisible,
    scheduleDates: buildScheduleDates(scheduledDate),
    issues: buildIssues(scheduledDate),
    onDateChange: (date: string) => {
      if (!confirmUnsavedChanges()) return;
      const tournamentId = competitionEngine.getTournamentInfo().tournamentInfo?.tournamentId;
      context.router?.navigate(`/tournament/${tournamentId}/${SCHEDULE2_TAB}/${date}/${state?.currentView || 'grid'}`);
    },
    onViewChange: (newView: Schedule2View) => {
      if (!confirmUnsavedChanges()) return;
      const tournamentId = competitionEngine.getTournamentInfo().tournamentInfo?.tournamentId;
      context.router?.navigate(`/tournament/${tournamentId}/${SCHEDULE2_TAB}/${scheduledDate}/${newView}`);
    },
    onToggleCatalog: () => {
      catalogVisible = !catalogVisible;
      writeCatalogVisible(catalogVisible);
      const layout = container.querySelector('.spl-layout, .sp-layout') as HTMLElement;
      if (layout) {
        layout.classList.toggle('spl-sidebar-collapsed', !catalogVisible);
      }
    },
    onSearch: (text, mode) => searchGridCells(text, mode),
    onBulkModeChange: (enabled: boolean) => {
      const result = setGridBulkMode(enabled);
      if (result !== enabled) {
        controlAnchor.innerHTML = '';
        renderSchedule2Tab(params);
      }
    },
    onClearSchedule: (target) =>
      openClearScheduleMenu({
        target,
        scheduledDate,
        onCleared: () => refreshGridView(),
      }),
  });
  controlAnchor.appendChild(header);

  // Render the active view
  if (view === 'profile') {
    renderProfileView(container, scheduledDate);
    // Profile view is configuration, not live data — let the sync indicator handle remote mutations
    context.refreshActiveTable = undefined;
  } else {
    renderGridView(container, scheduledDate);
    // Wire remote-mutation refresh so cells update when other clients schedule matchUps
    context.refreshActiveTable = refreshGridView;
  }

  // Apply persisted catalog visibility to the freshly rendered layout
  if (!catalogVisible) {
    const layout = container.querySelector('.spl-layout, .sp-layout') as HTMLElement | null;
    if (layout) layout.classList.add('spl-sidebar-collapsed');
  }
}

function destroyCurrentView(): void {
  if (!state) return;
  if (state.currentView === 'grid') destroyGridView();
  if (state.currentView === 'profile') destroyProfileView();
}

/** Check for unsaved changes; return true if safe to proceed, false to block. */
function confirmUnsavedChanges(): boolean {
  if (!hasUnsavedGridChanges()) return true;
  return window.confirm('You have unsaved scheduling changes. Discard and continue?');
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
