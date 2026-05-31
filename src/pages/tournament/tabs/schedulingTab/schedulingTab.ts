/**
 * Scheduling workspace — Option C unified surface.
 *
 * Replaces the two previously-separate tabs (`/schedule2` and
 * `/venues/availability`) with a single workspace that switches between
 * three modes.
 *
 * Profile and Grid modes reuse the exact same view-rendering machinery as
 * `/schedule2` (renderGridView, renderProfileView, buildGridHeaderActions,
 * openClearScheduleMenu) so their layout + behavior is identical until the
 * /schedule2 route is retired. Availability mode is still a placeholder
 * pending its own migration in a follow-up commit.
 *
 * Routes:
 *   /tournament/:id/scheduling                                    → default mode for today's date
 *   /tournament/:id/scheduling/:date                              → grid mode (default)
 *   /tournament/:id/scheduling/:date/availability
 *   /tournament/:id/scheduling/:date/profile
 *   /tournament/:id/scheduling/:date/grid
 */

import { competitionEngine } from 'services/factory/engine';
import { confirmModal } from 'components/modals/baseModal/baseModal';
import { context } from 'services/context';
import { resolveScheduleDate } from '../scheduleUtils';
import { buildSchedulingHeader } from './schedulingHeader';
import { buildGridHeaderActions } from '../schedule2Tab/gridHeaderActions';
import {
  renderGridView,
  destroyGridView,
  hasUnsavedGridChanges,
  setGridBulkMode,
  getGridBulkMode,
  getUnsavedGridChangeCount,
  searchGridCells,
  buildScheduleDates,
  refreshGridView,
  setGridActiveStripVisible,
  DEFAULT_MIN_COURT_GRID_ROWS,
} from '../schedule2Tab/gridView';
import { renderProfileView, destroyProfileView } from '../schedule2Tab/profileView';
import { openClearScheduleMenu } from '../schedule2Tab/clearScheduleActions';
import {
  renderAvailabilityGrid,
  type AvailabilityGridInstance,
} from '../venuesTab/renderAvailabilityGrid';
import {
  readScheduleDisplayConfig,
  writeScheduleDisplayConfig,
} from 'services/schedulePreferences/scheduleDisplayExtension';
import {
  subscribeQueue,
  hasUnsavedChanges,
  getPendingCount,
  savePending,
  discardPending,
  executeMethods,
} from 'services/schedulingWorkspace/queueService';

import { SCHEDULING_CONTAINER, SCHEDULING_CONTROL, SCHEDULING_TAB, TOURNAMENT } from 'constants/tmxConstants';

export type SchedulingMode = 'availability' | 'profile' | 'grid';

interface RenderSchedulingTabParams {
  scheduledDate?: string;
  mode?: SchedulingMode;
}

const VALID_MODES: SchedulingMode[] = ['availability', 'profile', 'grid'];
const DEFAULT_MODE: SchedulingMode = 'grid';

// Share the same localStorage keys as /schedule2 so a user's catalog +
// active-strip preferences carry across the two routes. When /schedule2 is
// retired, these keys can stay — they're scoped to the user, not the route.
const LAYOUT_SEL = '.spl-layout';
const COLLAPSED_CLASS = 'spl-sidebar-collapsed';
const GRID_CATALOG_VISIBILITY_KEY = 'schedule2:catalog:grid';
const PROFILE_CATALOG_VISIBILITY_KEY = 'schedule2:catalog:profile';
const ACTIVE_STRIP_VISIBILITY_KEY = 'schedule2:activeStrip';

let queueUnsubscribe: (() => void) | null = null;
let currentMode: SchedulingMode | null = null;
let availabilityInstance: AvailabilityGridInstance | null = null;

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

function isValidMode(value: string | undefined): value is SchedulingMode {
  return !!value && (VALID_MODES as string[]).includes(value);
}

export function renderSchedulingTab(params: RenderSchedulingTabParams = {}): void {
  const controlEl = document.getElementById(SCHEDULING_CONTROL);
  const containerEl = document.getElementById(SCHEDULING_CONTAINER);
  if (!controlEl || !containerEl) return;

  // 'today' is a sentinel used by the /venues/availability redirect when the
  // engine isn't reachable from the router callback — resolve it here.
  const isExplicitDate = params.scheduledDate && params.scheduledDate !== 'today';
  const resolvedDate = isExplicitDate ? params.scheduledDate! : resolveScheduleDate();
  const resolvedMode: SchedulingMode = isValidMode(params.mode) ? params.mode : DEFAULT_MODE;
  const { startDate, endDate } = competitionEngine.getCompetitionDateRange() ?? { startDate: '', endDate: '' };
  const tournamentId = competitionEngine.getTournamentInfo()?.tournamentInfo?.tournamentId ?? '';

  // Persist selected date for cross-route continuity with /schedule2.
  context.displayed.selectedScheduleDate = resolvedDate;

  // Build the header into SCHEDULING_CONTROL (mirrors schedule2's pattern).
  controlEl.innerHTML = '';
  destroyCurrentMode();
  containerEl.innerHTML = '';

  const header = buildSchedulingHeader({
    selectedDate: resolvedDate,
    activeMode: resolvedMode,
    startDate: startDate ?? '',
    endDate: endDate ?? '',
    scheduleDates: buildScheduleDates(resolvedDate),
    onDateChange: (date: string) => {
      guardUnsavedAndProceed(() => {
        context.router?.navigate(`/${TOURNAMENT}/${tournamentId}/${SCHEDULING_TAB}/${date}/${resolvedMode}`);
      });
    },
    onModeChange: (newMode: SchedulingMode) => {
      guardUnsavedAndProceed(() => {
        context.router?.navigate(`/${TOURNAMENT}/${tournamentId}/${SCHEDULING_TAB}/${resolvedDate}/${newMode}`);
      });
    },
  });
  controlEl.appendChild(header);

  // Render the active mode into the workspace container.
  if (resolvedMode === 'profile') {
    renderProfileMode(containerEl, resolvedDate);
  } else if (resolvedMode === 'grid') {
    renderGridMode(containerEl, resolvedDate, params);
  } else {
    renderAvailabilityMode(containerEl);
  }

  // Subscribe to the workspace queue so the action bar reflects bulk-queue
  // changes. (For Profile/Grid that still use schedule2's internal queue, the
  // workspace bar stays inert; only the Availability mode currently writes
  // through queueService.)
  queueUnsubscribe?.();
  queueUnsubscribe = subscribeQueue(refreshActionBar);
  refreshActionBar();
}

export function destroySchedulingTab(): void {
  queueUnsubscribe?.();
  queueUnsubscribe = null;
  destroyCurrentMode();
}

function destroyCurrentMode(): void {
  if (currentMode === 'grid') destroyGridView();
  else if (currentMode === 'profile') destroyProfileView();
  else if (currentMode === 'availability' && availabilityInstance) {
    availabilityInstance.destroy();
    availabilityInstance = null;
  }
  currentMode = null;
}

// ── Mode renderers ──

function renderProfileMode(container: HTMLElement, scheduledDate: string): void {
  currentMode = 'profile';
  const profileCatalogVisible = readBoolFlag(PROFILE_CATALOG_VISIBILITY_KEY, true);

  renderProfileView(container, scheduledDate, {
    catalogVisible: profileCatalogVisible,
    onToggleCatalog: (next: boolean) => {
      writeBoolFlag(PROFILE_CATALOG_VISIBILITY_KEY, next);
      const layout = container.querySelector(LAYOUT_SEL) as HTMLElement | null;
      if (layout) layout.classList.toggle(COLLAPSED_CLASS, !next);
    },
  });

  // Profile view is configuration, not live data.
  context.refreshActiveTable = undefined;

  if (!profileCatalogVisible) {
    const layout = container.querySelector(LAYOUT_SEL) as HTMLElement | null;
    if (layout) layout.classList.add(COLLAPSED_CLASS);
  }

  container.appendChild(buildActionBarMount());
}

function renderGridMode(container: HTMLElement, scheduledDate: string, params: RenderSchedulingTabParams): void {
  currentMode = 'grid';
  const gridCatalogVisible = readBoolFlag(GRID_CATALOG_VISIBILITY_KEY, true);
  const activeStripVisible = readBoolFlag(ACTIVE_STRIP_VISIBILITY_KEY, true);
  const controlAnchor = document.getElementById(SCHEDULING_CONTROL);

  const extensionMinRows = readScheduleDisplayConfig().minCourtGridRows;
  const effectiveMinRows = extensionMinRows ?? DEFAULT_MIN_COURT_GRID_ROWS;

  const gridActions = buildGridHeaderActions({
    selectedDate: scheduledDate,
    bulkMode: getGridBulkMode(),
    catalogVisible: gridCatalogVisible,
    activeStripVisible,
    minRows: effectiveMinRows,
    onToggleCatalog: (next: boolean) => {
      writeBoolFlag(GRID_CATALOG_VISIBILITY_KEY, next);
      const layout = container.querySelector(LAYOUT_SEL) as HTMLElement | null;
      if (layout) layout.classList.toggle(COLLAPSED_CLASS, !next);
    },
    onToggleActiveStrip: (next: boolean) => {
      writeBoolFlag(ACTIVE_STRIP_VISIBILITY_KEY, next);
      setGridActiveStripVisible(next);
    },
    onMinRowsChange: (rows: number) => {
      writeScheduleDisplayConfig({ minCourtGridRows: rows });
      refreshGridView();
    },
    onSearch: (text: string) => searchGridCells(text),
  });

  renderGridView(container, scheduledDate, {
    headerActions: gridActions.trailing,
    titleLeadingActions: gridActions.leading,
    titleSlot: gridActions.titleSlot,
    activeStripVisible,
    bulkMode: getGridBulkMode(),
    onBulkModeChange: (enabled: boolean) => {
      if (!enabled && hasUnsavedGridChanges()) {
        const count = getUnsavedGridChangeCount();
        confirmModal({
          title: 'Discard unsaved changes?',
          query: `You have ${count} unsaved scheduling change(s). Switching to immediate mode will discard them. Continue?`,
          okIntent: 'is-warning',
          okAction: () => {
            setGridBulkMode(enabled);
          },
          cancelAction: () => {
            if (controlAnchor) controlAnchor.innerHTML = '';
            renderSchedulingTab(params);
          },
        });
        return;
      }
      setGridBulkMode(enabled);
    },
    onClearSchedule: (target: any) =>
      openClearScheduleMenu({
        target,
        scheduledDate,
        onCleared: () => refreshGridView(),
      }),
  });

  // Wire remote-mutation refresh so cells update when other clients schedule matchUps.
  context.refreshActiveTable = refreshGridView;

  if (!gridCatalogVisible) {
    const layout = container.querySelector(LAYOUT_SEL) as HTMLElement | null;
    if (layout) layout.classList.add(COLLAPSED_CLASS);
  }

  container.appendChild(buildActionBarMount());
}

function renderAvailabilityMode(container: HTMLElement): void {
  currentMode = 'availability';

  // The painter mounts directly into a dedicated DIV inside the workspace
  // container so the workspace-level action bar can sit alongside it.
  // Horizontal padding mirrors the breathing room the capacity bar gets in
  // the schedule2 grid/profile views (which inherit it from createSchedulePage's
  // own layout chrome — the AvailabilityGrid component renders edge-to-edge).
  const gridHost = document.createElement('div');
  gridHost.style.cssText = 'width: 100%; height: calc(100vh - 200px); overflow: hidden; padding: 0 16px; box-sizing: border-box;';
  container.appendChild(gridHost);
  container.appendChild(buildActionBarMount());

  // Live availability writes route through queueService.executeMethods. In
  // immediate mode it dispatches via mutationRequest (today's behavior); in
  // bulk mode it queues alongside Profile/Grid pending methods and lights up
  // the workspace's sticky save/discard bar.
  //
  // The painter's own toolbar Save button only renders when an onSave config
  // callback is provided — without it the user has no commit affordance and
  // any painted block evaporates on mode switch. The callback delegates back
  // to instance.save(), which calls saveGridState → onMutationMethods (above).
  let instance: AvailabilityGridInstance | null = null;
  instance = renderAvailabilityGrid(gridHost, {
    onMutationMethods: (methods) => {
      executeMethods({ mode: 'availability', methods });
    },
    onSave: () => instance?.save(),
  });
  availabilityInstance = instance;

  // Availability is mostly configuration; live data refresh isn't required.
  context.refreshActiveTable = undefined;
}

// ── Unsaved-changes guard (mirrors schedule2Tab) ──

function guardUnsavedAndProceed(proceed: () => void): void {
  if (!hasUnsavedGridChanges() && !hasUnsavedChanges()) {
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

// ── Workspace queue action bar ──

let actionBarRef: HTMLElement | null = null;

function buildActionBarMount(): HTMLElement {
  actionBarRef = document.createElement('div');
  actionBarRef.style.cssText =
    'position: sticky; bottom: 0; padding: 8px 12px; background: var(--tmx-bg-secondary, #f4f4f4); border-top: 1px solid var(--tmx-border-primary, #ddd); display: none; gap: 12px; align-items: center;';
  return actionBarRef;
}

function refreshActionBar(): void {
  const bar = actionBarRef;
  if (!bar) return;
  if (!hasUnsavedChanges()) {
    bar.style.display = 'none';
    bar.innerHTML = '';
    return;
  }

  bar.style.display = 'flex';
  bar.innerHTML = '';

  const summary = document.createElement('div');
  summary.style.cssText = 'flex: 1; font-size: 0.9rem;';
  summary.textContent = `${getPendingCount()} unsaved change(s)`;
  bar.appendChild(summary);

  const discardBtn = document.createElement('button');
  discardBtn.type = 'button';
  discardBtn.textContent = 'Discard';
  discardBtn.style.cssText = 'padding: 6px 14px; cursor: pointer;';
  discardBtn.addEventListener('click', () => {
    void discardPending();
  });
  bar.appendChild(discardBtn);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save';
  saveBtn.style.cssText =
    'padding: 6px 14px; cursor: pointer; background: var(--tmx-fill-accent, #2563eb); color: #fff; border: 0; border-radius: 4px; font-weight: 600;';
  saveBtn.addEventListener('click', () => {
    void savePending();
  });
  bar.appendChild(saveBtn);
}
