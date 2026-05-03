/**
 * Schedule 2 — Grid View
 *
 * Wires the courthive-components Schedule Page into TMX using real factory data.
 * Builds a court grid from competitionScheduleMatchUps and passes it as the
 * courtGridElement to createSchedulePage. Handles drop/remove callbacks via
 * mutationRequest (immediate mode) or queues locally (bulk mode).
 *
 * Drag-drop flow:
 *  - Catalog → Grid: card dragstart sets CATALOG_MATCHUP payload; grid cell drop fires onMatchUpDrop
 *  - Grid → Grid: filled cell dragstart sets GRID_MATCHUP payload; target cell drop fires onMatchUpDrop
 *  - Grid → Catalog: filled cell dragged onto catalog drop zone fires onMatchUpRemove
 *  - After each mutation the grid, catalog, and dates are rebuilt from factory state.
 *
 * Bulk mode:
 *  - Mutations run locally on competitionEngine for visual feedback
 *  - Methods are queued in pendingMethods for batch server send
 *  - A floating Save/Discard bar appears when changes are pending
 *  - On Save: all queued methods sent as single mutationRequest
 *  - On Discard: factory state reloaded from IndexedDB
 */
import { competitionEngine, matchUpStatusConstants, factoryConstants, tools } from 'tods-competition-factory';
import { handleSchedule2CellClick, handleSchedule2RowClick } from './schedule2CellActions';
import { printCourtMatchUpCards } from 'components/modals/printCourtCards';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renameCourt } from 'components/modals/renameCourt';
import { tmxToast } from 'services/notifications/tmxToast';
import { scheduleConfig } from 'config/scheduleConfig';
import { tipster } from 'components/popovers/tipster';
import { tmx2db } from 'services/storage/tmx2db';
import tippy, { type Instance } from 'tippy.js';
import { t } from 'i18n';
import {
  createSchedulePage,
  buildScheduleGridCell,
  mapMatchUpToCellData,
  DEFAULT_SCHEDULE_CELL_CONFIG,
  matchUpLabel,
  isCompletedStatus,
  buildActiveStripPanel,
} from 'courthive-components';
import type {
  SchedulePageConfig,
  SchedulePageControl,
  CatalogMatchUpItem,
  ScheduleDate,
  ScheduleIssue,
  ScheduleIssueSeverity,
  ActiveStripPanel,
  ActiveStripPanelData,
} from 'courthive-components';

// constants
import { COMPETITION_ENGINE, MINIMUM_SCHEDULE_COLUMNS } from 'constants/tmxConstants';
import { ADD_MATCHUP_SCHEDULE_ITEMS } from 'constants/mutationConstants';
import { addVenue } from 'pages/tournament/tabs/venuesTab/addVenue';
import { hiddenCourtIds, syncVisibilityDate } from './visibilityState';
import { renderSchedule2Tab } from './schedule2Tab';

const { scheduleConstants } = factoryConstants;

const { BYE } = matchUpStatusConstants;

const DATA_COURT_ID = 'data-court-id';
const DATA_VENUE_ID = 'data-venue-id';
const DATA_COURT_ORDER = 'data-court-order';
const DATA_MATCHUP_ID = 'data-matchup-id';
const DATA_DRAW_ID = 'data-draw-id';
const POSITION_STICKY = 'position: sticky';
const FONT_SIZE_11 = 'font-size: 11px';
const DISPLAY_FLEX = 'display: flex';

// Grid layout constants — shared with the active strip so its leading spacer
// matches the row-number column and its court cells align with grid columns.
const GRID_TIME_COL_WIDTH_PX = 50;
const GRID_MIN_COURT_WIDTH_PX = 110;
const STRIP_CELL_HEIGHT_PX = 80;

let activeControl: SchedulePageControl | null = null;
let currentDate = '';
let bulkMode = false;
let pendingMethods: any[][] = []; // Each entry is a methods array from one drop/remove
let actionBar: HTMLElement | null = null;
let actionBarContainer: HTMLElement | null = null;
let gridRootElement: HTMLElement | null = null;
let visibilityTip: Instance | null = null;
// Late-bound refresh closure for the active grid render. Exposed via refreshGridView()
// so remote mutations (other clients editing the tournament) can update cells in place.
let currentRefresh: (() => void) | null = null;
let activeStrip: ActiveStripPanel | null = null;
let activeStripUnsubscribe: (() => void) | null = null;

export function renderGridView(container: HTMLElement, scheduledDate: string): void {
  syncVisibilityDate(scheduledDate);
  currentDate = scheduledDate;
  actionBarContainer = container;
  destroyVisibilityTip();

  // Late-binding refresh: grid cells reference this via closure, but grid is built
  // before activeControl exists. The wrapper defers to the real refresh once ready.
  function refresh(): void {
    if (!activeControl || !grid) return;
    grid.rebuild(currentDate);
    activeControl.setMatchUpCatalog(buildCatalog(currentDate));
    activeControl.setScheduleDates(buildScheduleDates(currentDate));
    activeControl.setIssues(buildIssues(currentDate));
    activeStrip?.setData(buildActiveStripData(currentDate));
  }
  currentRefresh = refresh;

  const gridCallbacks: GridCallbacks = { onRefresh: refresh, executeMethods };

  const catalog = buildCatalog(scheduledDate);
  const scheduleDates = buildScheduleDates(scheduledDate);
  const grid = buildInteractiveGrid(scheduledDate, gridCallbacks);
  const issues = buildIssues(scheduledDate);

  // ── Active Strip: one-row court summary above the grid ──
  activeStrip = buildActiveStripPanel(
    {
      onMatchUpDrop: (payload, target) => {
        handleActiveStripDrop(payload, target, refresh);
      },
    },
    {
      cellHeight: `${STRIP_CELL_HEIGHT_PX}px`,
      // Small label in the leading spacer cell. TODO i18n via t('schedule.now') when key exists.
      spacerLabel: 'Now',
      renderCell: (matchUp) => {
        const cellData = matchUp.payload as any;
        if (!cellData) return null;
        return buildScheduleGridCell(mapMatchUpToCellData(cellData), DEFAULT_SCHEDULE_CELL_CONFIG);
      },
    },
  );

  // Wrap strip + grid in a single scroll container so they pan horizontally as
  // one. The grid root's own overflow:auto is overridden — only the wrapper
  // scrolls, ensuring the strip's columns stay aligned with the grid below.
  // The strip is sticky-pinned so it stays visible while the grid scrolls
  // vertically. Grid column headers reference --strip-offset to stick BELOW
  // the strip rather than overlapping it; the offset toggles to 0 when the
  // strip is hidden.
  const gridWrapper = document.createElement('div');
  gridWrapper.style.cssText = 'display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: auto;';
  // +2 accounts for the strip's bottom accent rule.
  gridWrapper.style.setProperty('--strip-offset', `${STRIP_CELL_HEIGHT_PX + 2}px`);
  activeStrip.element.style.position = 'sticky';
  activeStrip.element.style.top = '0';
  activeStrip.element.style.zIndex = '3';
  activeStrip.element.style.flexShrink = '0';
  gridWrapper.appendChild(activeStrip.element);
  grid.element.style.overflow = 'visible';
  grid.element.style.flex = '1';
  grid.element.style.minHeight = '0';
  gridWrapper.appendChild(grid.element);

  const config: SchedulePageConfig = {
    matchUpCatalog: catalog,
    scheduleDates,
    issues,
    courtGridElement: gridWrapper,
    hideLeft: true,
    catalogSide: 'left',
    scheduledBehavior: 'dim',
    schedulingMode: 'immediate',

    onMatchUpDrop: (payload, event) => {
      // Walk up from event.target to find the grid cell with data attributes
      let target = event.target as HTMLElement | null;
      while (target && !target.getAttribute(DATA_COURT_ID)) {
        target = target.parentElement;
      }

      const courtId = target?.getAttribute(DATA_COURT_ID);
      const venueId = target?.getAttribute(DATA_VENUE_ID);
      const courtOrder = target?.getAttribute(DATA_COURT_ORDER);

      if (!courtId || !venueId || !courtOrder) return;

      const methods: any[] = [];

      // If the target cell already has a matchUp, unschedule it first (swap)
      const existingMatchUpId = target?.getAttribute(DATA_MATCHUP_ID);
      const existingDrawId = target?.getAttribute(DATA_DRAW_ID);
      if (existingMatchUpId) {
        methods.push({
          method: ADD_MATCHUP_SCHEDULE_ITEMS,
          params: {
            matchUpId: existingMatchUpId,
            drawId: existingDrawId ?? '',
            schedule: { scheduledTime: '', scheduledDate: '', courtOrder: '', venueId: '', courtId: '' },
            removePriorValues: true,
          },
        });
      }

      // If dragged from another grid cell, unschedule from source
      if (payload.type === 'GRID_MATCHUP') {
        const matchUp = payload.matchUp as any;
        methods.push({
          method: ADD_MATCHUP_SCHEDULE_ITEMS,
          params: {
            matchUpId: matchUp.matchUpId,
            drawId: matchUp.drawId ?? '',
            schedule: { scheduledTime: '', scheduledDate: '', courtOrder: '', venueId: '', courtId: '' },
            removePriorValues: true,
          },
        });
      }

      // Schedule the dropped matchUp onto the target cell
      const matchUp = payload.matchUp as any;
      methods.push({
        method: ADD_MATCHUP_SCHEDULE_ITEMS,
        params: {
          matchUpId: matchUp.matchUpId,
          drawId: matchUp.drawId ?? '',
          schedule: {
            courtOrder: Number.parseInt(courtOrder, 10),
            scheduledDate: currentDate,
            courtId,
            venueId,
          },
          removePriorValues: true,
        },
      });

      executeMethods(methods, refresh);
    },

    onMatchUpRemove: (matchUpId) => {
      // Find the matchUp's drawId from the catalog
      const catalog = buildCatalog(currentDate);
      const item = catalog.find((m) => m.matchUpId === matchUpId);

      const methods = [
        {
          method: ADD_MATCHUP_SCHEDULE_ITEMS,
          params: {
            matchUpId,
            drawId: item?.drawId ?? '',
            schedule: { scheduledTime: '', scheduledDate: '', courtOrder: '', venueId: '', courtId: '' },
            removePriorValues: true,
          },
        },
      ];

      executeMethods(methods, refresh);
    },

    onMatchUpSelected: (m) => {
      if (m) console.log('[schedule2] selected', m.matchUpId);
    },
  };

  activeControl = createSchedulePage(config, container);

  // Wire the strip's visibility toggle through the schedule page store, and
  // push the initial data snapshot now that the activeControl exists. We also
  // sync the --strip-offset CSS var on the wrapper so the grid's sticky column
  // headers stick BELOW the strip when it's visible, and at top:0 when hidden.
  const syncStripOffset = (visible: boolean) => {
    gridWrapper.style.setProperty('--strip-offset', visible ? `${STRIP_CELL_HEIGHT_PX + 2}px` : '0px');
  };
  activeStripUnsubscribe = activeControl.getStore().subscribe((nextState) => {
    activeStrip?.update(nextState);
    syncStripOffset(nextState.activeStripVisible);
  });
  const initialState = activeControl.getStore().getState();
  activeStrip.update(initialState);
  syncStripOffset(initialState.activeStripVisible);
  activeStrip.setData(buildActiveStripData(currentDate));

  // ── Inject sidebar controls: collapse toggle + Unscheduled/Scheduled tabs ──
  injectSidebarControls(container);
}

// ============================================================================
// Sidebar Controls (collapse + scheduled matchUp list)
// ============================================================================

function injectSidebarControls(container: HTMLElement): void {
  const layout = container.querySelector('.spl-layout') as HTMLElement;
  if (!layout) return;

  // The sidebar is the first child when catalogSide='left'
  const sidebar = layout.firstElementChild as HTMLElement;
  if (!sidebar) return;

  // Build control bar (tab switcher: Unscheduled / Scheduled)
  const controlBar = document.createElement('div');
  controlBar.style.cssText =
    'display: flex; align-items: center; gap: 4px; padding: 6px 8px; flex-shrink: 0; border-bottom: 1px solid var(--sp-border, var(--tmx-border-primary));';

  const unschedTab = document.createElement('button');
  const schedTab = document.createElement('button');
  const tabStyle = (active: boolean) =>
    [
      FONT_SIZE_11,
      'padding: 3px 8px',
      'border-radius: 10px',
      'cursor: pointer',
      'border: 1px solid transparent',
      'white-space: nowrap',
      active
        ? 'background: var(--sp-accent, var(--tmx-accent-blue, #3b82f6)); color: #fff; font-weight: 600;'
        : 'background: var(--sp-chip-bg, rgba(128,128,128,0.12)); color: inherit;',
    ].join('; ');
  unschedTab.style.cssText = tabStyle(true);
  unschedTab.textContent = t('schedule.unscheduled');
  schedTab.style.cssText = tabStyle(false);
  schedTab.textContent = t('schedule.scheduled');

  controlBar.appendChild(unschedTab);
  controlBar.appendChild(schedTab);

  // Scheduled matchUp list container
  const scheduledPanel = document.createElement('div');
  scheduledPanel.style.cssText = 'display: none; flex: 1; min-height: 0; overflow: auto; padding: 8px;';

  // The component's existing catalog content (everything after the control bar)
  const catalogContent = Array.from(sidebar.children);

  // Insert control bar at top
  sidebar.insertBefore(controlBar, sidebar.firstChild);
  sidebar.appendChild(scheduledPanel);

  let activeTab: 'unscheduled' | 'scheduled' = 'unscheduled';

  function updateScheduledPanel(): void {
    scheduledPanel.innerHTML = '';
    // Show matchUps that have a scheduled time on this date but are NOT yet placed on a court
    const { matchUps } = competitionEngine.allTournamentMatchUps({ inContext: true, nextMatchUps: true });
    const scheduled = (matchUps || []).filter((m: any) => {
      if (m.matchUpStatus === BYE) return false;
      if (isCompletedStatus(m.matchUpStatus)) return false;
      if (m.schedule?.scheduledDate !== currentDate) return false;
      if (m.schedule?.courtId) return false; // already on a court — don't show
      return true; // date match is sufficient — time is optional
    });

    if (!scheduled.length) {
      const hint = document.createElement('div');
      hint.style.cssText =
        'font-size: 11px; color: var(--sp-muted, var(--tmx-muted)); text-align: center; padding: 24px 8px;';
      hint.textContent = t('schedule.noScheduledMatchUps');
      scheduledPanel.appendChild(hint);
      return;
    }

    for (const m of scheduled) {
      const hasTime = !!m.schedule?.scheduledTime;
      const card = document.createElement('div');
      card.style.cssText = [
        'padding: 6px 8px',
        'margin-bottom: 4px',
        'border-radius: 8px',
        FONT_SIZE_11,
        'background: var(--sp-card-bg, var(--tmx-bg-secondary))',
        `border: 1px ${hasTime ? 'solid' : 'dashed'} var(--sp-border, var(--tmx-border-primary))`,
        `opacity: ${hasTime ? '1' : '0.7'}`,
        'cursor: grab',
        DISPLAY_FLEX,
        'flex-direction: column',
        'gap: 2px',
      ].join('; ');

      const titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-weight: 700; font-size: 11px;';
      titleEl.textContent = `${m.eventName || ''} ${m.roundName || ''}`.trim();

      const sidesEl = document.createElement('div');
      sidesEl.style.cssText = 'font-size: 10px; color: var(--sp-text, inherit);';
      sidesEl.textContent = (m.sides || [])
        .map((s: any) => s.participant?.participantName ?? s.participantName ?? '?')
        .join(' vs ');

      const metaEl = document.createElement('div');
      metaEl.style.cssText = 'font-size: 10px; color: var(--sp-muted, var(--tmx-muted));';
      metaEl.textContent = hasTime ? m.schedule.scheduledTime : t('schedule.noTimeSet');
      if (!hasTime) {
        metaEl.style.fontStyle = 'italic';
        metaEl.style.color = 'var(--tmx-accent-orange, #f59e0b)';
      }

      card.appendChild(titleEl);
      card.appendChild(sidesEl);
      card.appendChild(metaEl);

      // Make draggable — uses CATALOG_MATCHUP type so the grid's onMatchUpDrop assigns a court
      card.draggable = true;
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer!.setData(
          'application/json',
          JSON.stringify({
            type: 'CATALOG_MATCHUP',
            matchUp: {
              matchUpId: m.matchUpId,
              drawId: m.drawId,
              eventId: m.eventId,
              eventName: m.eventName,
              roundName: m.roundName,
              matchUpType: m.matchUpType,
              sides: (m.sides || []).map((s: any) => ({
                participantName: s.participant?.participantName ?? s.participantName,
                participantId: s.participantId ?? s.participant?.participantId,
              })),
            },
          }),
        );
        e.dataTransfer!.effectAllowed = 'move';
        card.style.opacity = '0.4';
      });
      card.addEventListener('dragend', () => {
        card.style.opacity = '';
      });

      scheduledPanel.appendChild(card);
    }
  }

  function setTab(tab: 'unscheduled' | 'scheduled'): void {
    activeTab = tab;
    unschedTab.style.cssText = tabStyle(tab === 'unscheduled');
    schedTab.style.cssText = tabStyle(tab === 'scheduled');

    if (tab === 'unscheduled') {
      scheduledPanel.style.display = 'none';
      for (const el of catalogContent) (el as HTMLElement).style.display = '';
    } else {
      for (const el of catalogContent) (el as HTMLElement).style.display = 'none';
      scheduledPanel.style.display = '';
      updateScheduledPanel();
    }
  }

  unschedTab.addEventListener('click', () => setTab('unscheduled'));
  schedTab.addEventListener('click', () => setTab('scheduled'));

  // Hook into refresh to update scheduled panel when visible
  const origRefresh = activeControl?.getStore().subscribe(() => {
    if (activeTab === 'scheduled') updateScheduledPanel();
  });
  // Store unsubscribe for cleanup (will be handled by destroyGridView → activeControl.destroy)
  void origRefresh; //NOSONAR
}

export function destroyGridView(): void {
  if (activeStripUnsubscribe) {
    activeStripUnsubscribe();
    activeStripUnsubscribe = null;
  }
  activeStrip = null;
  if (activeControl) {
    activeControl.destroy();
    activeControl = null;
  }
  removeActionBar();
  pendingMethods = [];
  actionBarContainer = null;
  gridRootElement = null;
  currentRefresh = null;
}

/** Toggle visibility of the one-row active courts strip via the store flag. */
export function setGridActiveStripVisible(visible: boolean): void {
  activeControl?.setActiveStripVisible(visible);
}

/** Refresh grid cells, catalog, dates, and issues from current factory state. */
export function refreshGridView(): void {
  currentRefresh?.();
}

/** Whether there are unsaved bulk scheduling changes. */
export function hasUnsavedGridChanges(): boolean {
  return bulkMode && pendingMethods.length > 0;
}

/** Set bulk mode on/off. Returns the new state. */
export function setGridBulkMode(enabled: boolean): boolean {
  if (bulkMode === enabled) return bulkMode;

  // If turning off bulk mode with pending changes, warn
  if (!enabled && pendingMethods.length > 0) {
    const confirmed = globalThis.confirm(
      `You have ${pendingMethods.length} unsaved scheduling change(s). Switching to immediate mode will discard them. Continue?`,
    );
    if (!confirmed) return bulkMode;
    discardPending();
  }

  bulkMode = enabled;
  return bulkMode;
}

export function getGridBulkMode(): boolean {
  return bulkMode;
}

const SEARCH_HIGHLIGHT_CLASS = 'sch2-search-highlight';

function ensureSearchHighlightStyle(): void {
  if (document.getElementById('sch2-search-style')) return;
  const style = document.createElement('style');
  style.id = 'sch2-search-style';
  style.textContent = `.${SEARCH_HIGHLIGHT_CLASS} { outline: 2px solid #f59e0b; outline-offset: -2px; background: rgba(245, 158, 11, 0.15) !important; }`;
  document.head.appendChild(style);
}

/** Highlight grid cells matching search text; scroll first match into view. */
export function searchGridCells(text: string, _mode: 'individual' | 'team'): void {
  if (!gridRootElement) return;
  ensureSearchHighlightStyle();

  // Remove previous highlights
  const prev = gridRootElement.querySelectorAll(`.${SEARCH_HIGHLIGHT_CLASS}`);
  for (const el of prev) el.classList.remove(SEARCH_HIGHLIGHT_CLASS);

  if (!text.trim()) return;

  const needle = text.trim().toLowerCase();
  const cells = gridRootElement.querySelectorAll(`[${DATA_MATCHUP_ID}]`);
  let firstMatch: HTMLElement | null = null;

  for (const cell of cells) {
    const el = cell as HTMLElement;
    // For 'team' mode, match against team names (data attribute or full text)
    // For 'individual' mode, match against participant names in the cell
    const cellText = el.textContent?.toLowerCase() || '';
    if (cellText.includes(needle)) {
      el.classList.add(SEARCH_HIGHLIGHT_CLASS);
      firstMatch ??= el;
    }
  }

  if (firstMatch) {
    firstMatch.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
}

// ============================================================================
// Bulk Mode — Execute / Save / Discard
// ============================================================================

/**
 * Execute mutation methods — immediate or bulk.
 * In immediate mode: sends via mutationRequest (server + local).
 * In bulk mode: runs locally on competitionEngine, queues for batch send.
 */
function executeMethods(methods: any[], onRefresh: () => void): void {
  if (!bulkMode) {
    mutationRequest({
      methods,
      engine: COMPETITION_ENGINE,
      callback: (result: any) => {
        if (!result.success) console.log('[schedule2] mutation error', result);
        onRefresh();
      },
    });
    return;
  }

  // Bulk mode: execute locally for visual feedback
  const directives = tools.makeDeepCopy(methods);
  const result = competitionEngine.executionQueue(directives, true);
  if (result?.error) {
    console.error('[schedule2] local execution error', result);
    tmxToast({ message: 'Schedule change failed locally', intent: 'is-danger' });
    return;
  }

  // Queue methods for batch server send
  pendingMethods.push(methods);
  onRefresh();
  updateActionBar();
}

/** Save all pending bulk changes to server. */
async function savePending(): Promise<void> {
  if (!pendingMethods.length) return;

  // Flatten all queued method arrays into one batch
  const allMethods = pendingMethods.flat();
  pendingMethods = [];

  mutationRequest({
    methods: allMethods,
    engine: COMPETITION_ENGINE,
    callback: (result: any) => {
      if (result?.success || !result?.error) {
        tmxToast({ message: `Saved ${allMethods.length} scheduling changes`, intent: 'is-success' });
      } else {
        console.error('[schedule2] bulk save error', result);
        tmxToast({ message: 'Failed to save scheduling changes to server', intent: 'is-danger' });
      }
      updateActionBar();
    },
  });

  updateActionBar();
}

/** Discard pending changes by reloading factory state from IndexedDB. */
async function discardPending(): Promise<void> {
  if (!pendingMethods.length) {
    pendingMethods = [];
    updateActionBar();
    return;
  }

  const tournamentId = competitionEngine.getTournamentInfo()?.tournamentInfo?.tournamentId;
  if (!tournamentId) return;

  try {
    const record = await tmx2db.findTournament(tournamentId);
    if (record) {
      competitionEngine.setState(record);
    }
  } catch (err) {
    console.error('[schedule2] failed to reload from IndexedDB', err);
  }

  pendingMethods = [];
  tmxToast({ message: 'Scheduling changes discarded', intent: 'is-warning' });
  updateActionBar();

  // Re-render the grid view to reflect restored state
  if (activeControl && actionBarContainer) {
    const container = actionBarContainer;
    const date = currentDate;
    destroyGridView();
    renderGridView(container, date);
  }
}

// ============================================================================
// Action Bar (floating save/discard bar for bulk mode)
// ============================================================================

function updateActionBar(): void {
  if (!bulkMode || !pendingMethods.length) {
    removeActionBar();
    return;
  }
  if (!actionBarContainer) return;

  if (!actionBar) {
    actionBar = document.createElement('div');
    actionBar.style.cssText = [
      POSITION_STICKY,
      'bottom: 0',
      'z-index: 10',
      DISPLAY_FLEX,
      'align-items: center',
      'gap: 12px',
      'padding: 10px 16px',
      'background: var(--sp-panel-bg, var(--tmx-bg-primary))',
      'border-top: 2px solid var(--sp-accent, var(--tmx-accent-blue))',
      'box-shadow: 0 -2px 8px rgba(0,0,0,0.1)',
    ].join('; ');
    actionBarContainer.appendChild(actionBar);
  }

  const count = pendingMethods.length;
  const totalMethods = pendingMethods.flat().length;

  actionBar.innerHTML = '';

  // Save button
  const saveBtn = document.createElement('button');
  saveBtn.className = 'sp-btn sp-btn--success';
  saveBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up" style="margin-right:6px;"></i>Save ${totalMethods} change${totalMethods === 1 ? '' : 's'}`;
  saveBtn.addEventListener('click', () => savePending());
  actionBar.appendChild(saveBtn);

  // Discard button
  const discardBtn = document.createElement('button');
  discardBtn.className = 'sp-btn sp-btn--danger';
  discardBtn.innerHTML = '<i class="fa-solid fa-rotate-left" style="margin-right:6px;"></i>Discard';
  discardBtn.addEventListener('click', () => discardPending());
  actionBar.appendChild(discardBtn);

  // Status text
  const status = document.createElement('span');
  status.style.cssText = 'font-size: 0.75rem; color: var(--sp-warn-text, var(--tmx-accent-orange, #f59e0b));';
  status.textContent = `${count} unsaved action${count === 1 ? '' : 's'} — changes are local only`;
  actionBar.appendChild(status);
}

function removeActionBar(): void {
  if (actionBar) {
    actionBar.remove();
    actionBar = null;
  }
}

// ============================================================================
// Interactive Court Grid (with drag/drop + data attributes)
// ============================================================================

interface InteractiveGrid {
  element: HTMLElement;
  rebuild: (date: string) => void;
}

interface GridCallbacks {
  onRefresh: () => void;
  executeMethods: (methods: any[], onRefresh: () => void) => void;
}

function buildRowCourtCells(params: {
  grid: HTMLElement;
  row: any;
  ri: number;
  visibleCourts: { court: any; originalIndex: number }[];
  courtPrefix: string;
  emptyCellStyle: string;
  allRows: any[];
  callbacks: GridCallbacks;
}): void {
  const { grid, row, ri, visibleCourts, courtPrefix, emptyCellStyle, allRows, callbacks } = params;
  for (const visibleCourt of visibleCourts) {
    if (!row) {
      const emptyCell = document.createElement('div');
      emptyCell.style.cssText = emptyCellStyle;
      grid.appendChild(emptyCell);
      continue;
    }

    const cellKey = `${courtPrefix}${visibleCourt.originalIndex}`;
    const cellData = row[cellKey];

    const courtInfo = visibleCourt.court;
    const courtId = cellData?.schedule?.courtId ?? courtInfo?.courtId ?? '';
    const venueId = cellData?.schedule?.venueId ?? courtInfo?.venueId ?? '';
    const courtOrder = cellData?.schedule?.courtOrder ?? ri + 1;

    const cellContent = buildScheduleGridCell(mapMatchUpToCellData(cellData || {}), DEFAULT_SCHEDULE_CELL_CONFIG);

    const cell = document.createElement('div');
    cell.style.cssText = 'min-height: 60px; font-size: 11px;';
    cell.setAttribute(DATA_COURT_ID, courtId);
    cell.setAttribute(DATA_VENUE_ID, venueId);
    cell.setAttribute(DATA_COURT_ORDER, String(courtOrder));

    const matchUpId = cellContent.getAttribute(DATA_MATCHUP_ID);
    const drawId = cellContent.getAttribute(DATA_DRAW_ID);
    if (matchUpId) cell.setAttribute(DATA_MATCHUP_ID, matchUpId);
    if (drawId) cell.setAttribute(DATA_DRAW_ID, drawId);

    cell.appendChild(cellContent);

    if (cellData?.matchUpId) {
      attachCellDragSource(cell, cellData);
    }

    if (!cellData?.isBlocked) {
      attachCellDropTarget(cell);
    }

    cell.addEventListener('click', (e: MouseEvent) => {
      if (cell.draggable && cell.style.opacity === '0.4') return;

      handleSchedule2CellClick(e, {
        cellData,
        courtId,
        venueId,
        courtOrder,
        scheduledDate: currentDate,
        allRows,
        courtPrefix,
        rowIndex: ri,
        onRefresh: callbacks.onRefresh,
        executeMethods: callbacks.executeMethods,
        matchUpListProvider: () => getFilteredMatchUpList(currentDate, activeControl),
        findCatalogItem: (mid: string) => buildCatalog(currentDate).find((m) => m.matchUpId === mid),
      });
    });
    cell.style.cursor = cell.draggable ? 'grab' : 'pointer';

    grid.appendChild(cell);
  }
}

function getFilteredMatchUpList(date: string, control: SchedulePageControl | null): { label: string; value: string }[] {
  const catalog = buildCatalog(date);
  const storeState = control?.getStore().getState();
  const filters = storeState?.catalogFilters;
  const showCompleted = storeState?.showCompleted ?? false;
  return catalog
    .filter(
      (m) =>
        !m.isScheduled &&
        (m.sides?.length ?? 0) >= 1 &&
        (showCompleted || !isCompletedStatus(m.matchUpStatus)) &&
        (!filters?.eventType || m.matchUpType === filters.eventType) &&
        (!filters?.eventName || m.eventName === filters.eventName) &&
        (!filters?.drawName || (m.drawName ?? m.drawId) === filters.drawName) &&
        (!filters?.gender || m.gender === filters.gender) &&
        (!filters?.roundName || m.roundName === filters.roundName),
    )
    .map((m) => ({
      label: `${m.eventName} ${m.roundName || ''} — ${matchUpLabel(m)}`.trim(),
      value: m.matchUpId,
    }));
}

function attachCellDragSource(cell: HTMLElement, cellData: any): void {
  cell.draggable = true;
  cell.title = `${cellData.eventName || ''} ${cellData.roundName || ''}`.trim();

  cell.addEventListener('dragstart', (e) => {
    e.dataTransfer!.setData(
      'application/json',
      JSON.stringify({
        type: 'GRID_MATCHUP',
        matchUp: {
          matchUpId: cellData.matchUpId,
          drawId: cellData.drawId,
          eventId: cellData.eventId,
          eventName: cellData.eventName,
          roundName: cellData.roundName,
          matchUpType: cellData.matchUpType,
          sides: (cellData.sides || []).map((s: any) => ({
            participantName: s.participant?.participantName ?? s.participantName,
            participantId: s.participantId ?? s.participant?.participantId,
          })),
        },
      }),
    );
    e.dataTransfer!.effectAllowed = 'move';
    cell.style.opacity = '0.4';
  });
  cell.addEventListener('dragend', () => {
    cell.style.opacity = '';
  });
}

function attachCellDropTarget(cell: HTMLElement): void {
  cell.addEventListener('dragover', (e) => {
    e.preventDefault();
    cell.style.outline = '2px solid var(--sp-accent-focus, #3b82f6)';
    cell.style.outlineOffset = '-2px';
    e.dataTransfer!.dropEffect = 'move';
  });
  cell.addEventListener('dragleave', () => {
    cell.style.outline = '';
    cell.style.outlineOffset = '';
  });
  cell.addEventListener('drop', (e) => {
    e.preventDefault();
    cell.style.outline = '';
    cell.style.outlineOffset = '';
  });
}

// ============================================================================
// Court Visibility
// ============================================================================

function getCourtMatchUpCounts(rows: any[], courtsData: any[], courtPrefix: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const court of courtsData) counts.set(court.courtId, 0);
  for (const row of rows) {
    for (let ci = 0; ci < courtsData.length; ci++) {
      const cellData = row[`${courtPrefix}${ci}`];
      if (cellData?.matchUpId) {
        const courtId = courtsData[ci].courtId;
        counts.set(courtId, (counts.get(courtId) ?? 0) + 1);
      }
    }
  }
  return counts;
}

function destroyVisibilityTip(): void {
  if (visibilityTip) {
    visibilityTip.destroy();
    visibilityTip = null;
  }
}

function buildVisibilityPopover(
  allCourtsData: any[],
  matchUpCounts: Map<string, number>,
  onChanged: () => void,
): HTMLElement {
  const pop = document.createElement('div');
  pop.style.cssText =
    'padding: 10px; min-width: 220px; max-width: 300px; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px;';

  // quick actions
  const actions = document.createElement('div');
  actions.style.cssText = DISPLAY_FLEX + '; gap: 6px; margin-bottom: 8px;';

  const showAllBtn = document.createElement('button');
  showAllBtn.className = 'button font-medium';
  showAllBtn.style.cssText = 'font-size: 11px; padding: 2px 8px; border-radius: 4px; cursor: pointer;';
  showAllBtn.textContent = t('schedule.showAll');
  showAllBtn.addEventListener('click', () => {
    hiddenCourtIds.clear();
    destroyVisibilityTip();
    onChanged();
  });

  const hideEmptyBtn = document.createElement('button');
  hideEmptyBtn.className = 'button font-medium';
  hideEmptyBtn.style.cssText = 'font-size: 11px; padding: 2px 8px; border-radius: 4px; cursor: pointer;';
  hideEmptyBtn.textContent = t('schedule.hideEmpty');
  hideEmptyBtn.addEventListener('click', () => {
    for (const court of allCourtsData) {
      if ((matchUpCounts.get(court.courtId) ?? 0) === 0) {
        hiddenCourtIds.add(court.courtId);
      }
    }
    destroyVisibilityTip();
    onChanged();
  });

  actions.appendChild(showAllBtn);
  actions.appendChild(hideEmptyBtn);
  pop.appendChild(actions);

  // court list grouped by venue
  const venueMap = new Map<string, any[]>();
  for (const court of allCourtsData) {
    const key = court.venueName || court.venueId || '';
    if (!venueMap.has(key)) venueMap.set(key, []);
    venueMap.get(key)!.push(court);
  }

  for (const [venueName, courts] of venueMap) {
    if (venueMap.size > 1) {
      const venueLabel = document.createElement('div');
      venueLabel.style.cssText =
        'font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--sp-muted, #9ca3af); margin: 6px 0 2px;';
      venueLabel.textContent = venueName;
      pop.appendChild(venueLabel);
    }

    for (const court of courts) {
      const count = matchUpCounts.get(court.courtId) ?? 0;
      const isHidden = hiddenCourtIds.has(court.courtId);

      const row = document.createElement('label');
      row.style.cssText =
        DISPLAY_FLEX +
        '; align-items: center; gap: 6px; padding: 3px 0; cursor: pointer;' +
        (count === 0 ? ' opacity: 0.5;' : '');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !isHidden;
      checkbox.style.cssText = 'cursor: pointer; accent-color: var(--tmx-accent-blue, #3b82f6);';
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          hiddenCourtIds.delete(court.courtId);
        } else {
          hiddenCourtIds.add(court.courtId);
        }
        destroyVisibilityTip();
        onChanged();
      });

      const name = document.createElement('span');
      name.style.cssText = 'flex: 1;';
      name.textContent = court.courtName || court.courtId;

      const badge = document.createElement('span');
      badge.style.cssText = 'font-size: 10px; color: var(--sp-muted, #9ca3af);';
      badge.textContent = count > 0 ? `${count}` : t('schedule.empty');

      row.appendChild(checkbox);
      row.appendChild(name);
      row.appendChild(badge);
      pop.appendChild(row);
    }
  }

  return pop;
}

function buildGridHeaders(params: {
  grid: HTMLElement;
  stickyHeader: string;
  courtsData: any[];
  courtCount: number;
  emptyCount: number;
  handleAddVenue: () => void;
  allCourtsData?: any[];
  matchUpCounts?: Map<string, number>;
  onVisibilityChanged?: () => void;
  scheduledDate?: string;
}): HTMLElement[] {
  const { grid, stickyHeader, courtsData, courtCount, emptyCount, handleAddVenue, allCourtsData, matchUpCounts, onVisibilityChanged, scheduledDate } = params;
  const corner = document.createElement('div');
  corner.style.cssText =
    stickyHeader +
    '; left: 0; z-index: 3; color: var(--sp-muted); cursor: pointer;' +
    DISPLAY_FLEX +
    '; align-items: center; justify-content: center; gap: 4px;';

  const eyeIcon = document.createElement('i');
  eyeIcon.className = hiddenCourtIds.size > 0 ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  eyeIcon.style.cssText = 'font-size: 12px;';
  corner.appendChild(eyeIcon);

  if (hiddenCourtIds.size > 0) {
    const badge = document.createElement('span');
    badge.style.cssText =
      'font-size: 9px; font-weight: 700; background: var(--tmx-accent-blue, #3b82f6); color: #fff; border-radius: 50%; min-width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center;';
    badge.textContent = String(hiddenCourtIds.size);
    corner.appendChild(badge);
  }

  if (allCourtsData && matchUpCounts && onVisibilityChanged) {
    corner.addEventListener('click', () => {
      destroyVisibilityTip();
      const content = buildVisibilityPopover(allCourtsData, matchUpCounts, onVisibilityChanged);
      visibilityTip = tippy(corner, {
        content,
        theme: 'light-border',
        trigger: 'manual',
        interactive: true,
        placement: 'bottom-start',
        appendTo: () => document.body,
      });
      visibilityTip.show();
    });
  }

  grid.appendChild(corner);

  const courtHeaders: HTMLElement[] = [];
  const showCourtIdentifiers = () => scheduleConfig.get().court_identifiers !== false;
  for (let ci = 0; ci < courtCount; ci++) {
    const court = courtsData[ci];
    const courtName = court.courtName || `Court ${ci + 1}`;
    const th = document.createElement('div');
    th.style.cssText = stickyHeader + '; cursor: pointer;';
    th.title = courtName;
    th.textContent = showCourtIdentifiers() ? courtName : '';
    th.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      const visible = showCourtIdentifiers();
      const addremove = visible ? t('remove') : t('add');
      const courtInfo = { courtId: court.courtId, courtName };
      const columnShim = {
        updateDefinition: ({ title }: { title: string }) => {
          th.textContent = showCourtIdentifiers() ? title : '';
          th.title = title;
        },
      };
      tipster({
        target: e.currentTarget as HTMLElement,
        options: [
          {
            option: `${addremove} ${t('settings.courtidentifiers')}`,
            onClick: () => {
              scheduleConfig.set({ court_identifiers: !visible });
              const showing = showCourtIdentifiers();
              for (let i = 0; i < courtHeaders.length; i++) {
                const c = courtsData[i];
                const name = c?.courtName || `Court ${i + 1}`;
                courtHeaders[i].textContent = showing ? name : '';
              }
            },
          },
          {
            option: t('rename'),
            onClick: () => renameCourt({ column: columnShim, courtInfo }),
          },
          {
            option: 'Print court card(s)',
            onClick: () => printCourtMatchUpCards({ courtId: court.courtId, courtName, scheduledDate }),
          },
        ],
      });
    });
    courtHeaders.push(th);
    grid.appendChild(th);
  }

  for (let ei = 0; ei < emptyCount; ei++) {
    const th = document.createElement('div');
    th.style.cssText = stickyHeader + '; opacity: 0.6;';
    if (ei === 0) {
      const addVenueLabel = t('pages.venues.addVenue.title');
      if (courtCount === 0) {
        th.innerHTML = `<button style="font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 6px; border: 1px solid var(--tmx-accent-blue, #3b82f6); background: var(--tmx-bg-primary, #fff); color: var(--tmx-accent-blue, #3b82f6); cursor: pointer;">${addVenueLabel}</button>`;
      } else {
        th.innerHTML = `<span style="font-weight: normal; color: var(--tmx-accent-blue, #3b82f6); cursor: pointer;">${addVenueLabel}</span>`;
      }
      th.style.cursor = 'pointer';
      th.addEventListener('click', (e) => {
        e.stopPropagation();
        handleAddVenue();
      });
    }
    grid.appendChild(th);
  }

  return courtHeaders;
}

function buildInteractiveGrid(selectedDate: string, callbacks: GridCallbacks): InteractiveGrid {
  const MIN_COURT_WIDTH = GRID_MIN_COURT_WIDTH_PX;
  const TIME_COL_WIDTH = GRID_TIME_COL_WIDTH_PX;
  const MIN_PLACEHOLDER_ROWS = 8;

  const root = document.createElement('div');
  root.style.cssText = 'width: 100%; height: 100%; overflow: auto;';
  gridRootElement = root;

  const handleAddVenue = () => {
    addVenue((result: any) => {
      if (result?.success) {
        renderSchedule2Tab({ scheduledDate: currentDate });
      }
    }, COMPETITION_ENGINE);
  };

  function render(date: string): void {
    root.innerHTML = '';

    const scheduleResult = competitionEngine.competitionScheduleMatchUps({
      matchUpFilters: { scheduledDate: date },
      courtCompletedMatchUps: true,
      withCourtGridRows: true,
      minCourtGridRows: scheduleConfig.get().minCourtGridRows,
    });

    const rows: any[] = scheduleResult.rows || [];
    const allCourtsData: any[] = scheduleResult.courtsData || [];
    const courtPrefix: string = scheduleResult.courtPrefix || 'C|';

    // Run proConflicts and annotate cell data with issue styling info
    if (allCourtsData.length) annotateConflicts(rows, allCourtsData, courtPrefix);

    // Court visibility: compute matchUp counts, then filter to visible courts
    const matchUpCounts = getCourtMatchUpCounts(rows, allCourtsData, courtPrefix);

    // Prune hiddenCourtIds of courts that no longer exist
    for (const id of hiddenCourtIds) {
      if (!allCourtsData.some((c) => c.courtId === id)) hiddenCourtIds.delete(id);
    }

    // Build visible courts with mapping to original indices (for cell data lookup)
    const visibleCourts: { court: any; originalIndex: number }[] = [];
    for (let i = 0; i < allCourtsData.length; i++) {
      if (!hiddenCourtIds.has(allCourtsData[i].courtId)) {
        visibleCourts.push({ court: allCourtsData[i], originalIndex: i });
      }
    }
    const courtsData = visibleCourts.map((vc) => vc.court);
    const courtCount = courtsData.length;

    // Calculate placeholder columns to fill remaining space (always at least 1 for "Add venue")
    const emptyCalc = MINIMUM_SCHEDULE_COLUMNS - courtCount;
    const emptyCount = emptyCalc <= 0 ? 1 : emptyCalc;
    const totalColumns = courtCount + emptyCount;

    // Ensure we have enough rows to display even when no courts
    const displayRows = rows.length || MIN_PLACEHOLDER_ROWS;

    const grid = document.createElement('div');
    grid.style.cssText = [
      'display: grid',
      'gap: 1px',
      'background: var(--sp-line, #e5e7eb)',
      `min-width: ${TIME_COL_WIDTH + totalColumns * MIN_COURT_WIDTH}px`,
      `grid-template-columns: ${TIME_COL_WIDTH}px repeat(${totalColumns}, minmax(${MIN_COURT_WIDTH}px, 1fr))`,
    ].join('; ');

    const STICKY_HEADER = [
      POSITION_STICKY,
      // top tracks the sticky strip above (set on the scroll wrapper). When
      // the strip is hidden the var resolves to 0px so headers stick to the
      // viewport top.
      'top: var(--strip-offset, 0px)',
      'z-index: 2',
      'background: var(--sp-panel-bg, #fff)',
      'padding: 6px 4px',
      FONT_SIZE_11,
      'font-weight: 700',
      'text-align: center',
      'white-space: nowrap',
      'overflow: hidden',
      'text-overflow: ellipsis',
    ].join('; ');

    const STICKY_ROW = [
      POSITION_STICKY,
      'left: 0',
      'z-index: 1',
      'background: var(--sp-panel-bg, #fff)',
      'padding: 6px 4px',
      FONT_SIZE_11,
      'font-weight: 600',
      'color: var(--sp-muted, #888)',
      DISPLAY_FLEX,
      'align-items: center',
      'justify-content: center',
    ].join('; ');

    const EMPTY_CELL = 'min-height: 60px; background: var(--sp-panel-bg, #fff); opacity: 0.4;';

    const onVisibilityChanged = () => {
      destroyVisibilityTip();
      render(date);
    };
    const courtHeaders = buildGridHeaders({
      grid,
      stickyHeader: STICKY_HEADER,
      courtsData,
      courtCount,
      emptyCount,
      handleAddVenue,
      allCourtsData,
      matchUpCounts,
      onVisibilityChanged,
      scheduledDate: date,
    });

    // ── Data rows ──

    const rowLabels: HTMLElement[] = [];
    for (let ri = 0; ri < displayRows; ri++) {
      const row = ri < rows.length ? rows[ri] : null;

      const rowCell = document.createElement('div');
      rowCell.style.cssText = STICKY_ROW + (row ? '; cursor: pointer;' : '');
      rowCell.textContent = String(ri + 1);
      if (row) {
        rowCell.addEventListener('click', (e: MouseEvent) => {
          handleSchedule2RowClick(e, {
            executeMethods: callbacks.executeMethods,
            onRefresh: callbacks.onRefresh,
            rowData: row,
            courtPrefix,
            courtsData,
          });
        });
      }
      rowLabels.push(rowCell);
      grid.appendChild(rowCell);

      buildRowCourtCells({ grid, row, ri, visibleCourts, courtPrefix, emptyCellStyle: EMPTY_CELL, allRows: rows, callbacks });

      // Placeholder cells for empty columns
      for (let ei = 0; ei < emptyCount; ei++) {
        const emptyCell = document.createElement('div');
        emptyCell.style.cssText = EMPTY_CELL;
        grid.appendChild(emptyCell);
      }
    }

    // ── Apply issue indicators to court headers and row labels ──
    // Use allTournamentMatchUps-based proConflicts (annotateConflicts' cell data misses some conflict types)
    applyHeaderRowIssueIndicators(courtHeaders, rowLabels, courtsData, date);

    root.appendChild(grid);
  }

  // Initial render
  render(selectedDate);

  return {
    element: root,
    rebuild: (date: string) => render(date),
  };
}

// ============================================================================
// Factory Data Helpers
// ============================================================================

/** Pull side participant IDs out of a factory matchUp (handles team/individual nesting). */
function extractParticipantIds(matchUp: any): string[] {
  const ids: string[] = [];
  for (const side of matchUp?.sides ?? []) {
    const participant = side.participant;
    if (!participant) {
      const sideId = side.participantId;
      if (sideId) ids.push(sideId);
      continue;
    }
    if (participant.individualParticipantIds?.length) {
      for (const id of participant.individualParticipantIds) ids.push(id);
    } else if (participant.participantId) {
      ids.push(participant.participantId);
    }
  }
  return ids;
}

/** Translate the factory schedule snapshot into the active-strip pure-logic shape. */
function buildActiveStripData(date: string): ActiveStripPanelData {
  const result = competitionEngine.competitionScheduleMatchUps({
    matchUpFilters: { scheduledDate: date },
    courtCompletedMatchUps: true,
    withCourtGridRows: true,
    minCourtGridRows: scheduleConfig.get().minCourtGridRows,
  });

  const rows: any[] = result.rows ?? [];
  const allCourtsData: any[] = result.courtsData ?? [];
  const courtPrefix: string = result.courtPrefix ?? 'C|';

  // Mirror gridView's visible-court filter so the strip and grid agree
  const visibleCourts: { court: any; originalIndex: number }[] = [];
  for (let i = 0; i < allCourtsData.length; i++) {
    if (!hiddenCourtIds.has(allCourtsData[i].courtId)) {
      visibleCourts.push({ court: allCourtsData[i], originalIndex: i });
    }
  }

  const columns = visibleCourts.map(({ court, originalIndex }) => ({
    courtId: court.courtId,
    cells: rows.map((row) => {
      const cell = row?.[`${courtPrefix}${originalIndex}`];
      if (!cell?.matchUpId) return null;
      return {
        matchUpId: cell.matchUpId,
        drawId: cell.drawId,
        roundNumber: cell.roundNumber,
        matchUpStatus: cell.matchUpStatus,
        winningSide: cell.winningSide,
        hasScore: !!(cell.score?.scoreStringSide1 || cell.score?.scoreStringSide2),
        participantIds: extractParticipantIds(cell),
        // Stash the raw factory cell so the panel's renderCell can build the
        // same grid-cell DOM (eventName, sides, score, etc.) as the grid below.
        payload: cell,
      };
    }),
  }));

  const courts = visibleCourts.map(({ court }) => ({
    courtId: court.courtId,
    label: court.courtName ?? court.courtId,
  }));

  // Match the grid's grid-template-columns (sticky row-number col + visible
  // courts + placeholder columns) so the strip's leading spacer + court cells
  // line up exactly with the grid below.
  const courtCount = visibleCourts.length;
  const emptyCalc = MINIMUM_SCHEDULE_COLUMNS - courtCount;
  const emptyCount = emptyCalc <= 0 ? 1 : emptyCalc;
  const totalColumns = courtCount + emptyCount;
  const gridTemplateColumns = `${GRID_TIME_COL_WIDTH_PX}px repeat(${totalColumns}, minmax(${GRID_MIN_COURT_WIDTH_PX}px, 1fr))`;
  const minWidth = `${GRID_TIME_COL_WIDTH_PX + totalColumns * GRID_MIN_COURT_WIDTH_PX}px`;

  return { grid: { columns }, courts, gridTemplateColumns, minWidth };
}

/** Drop handler for the active strip — uses the resolved (courtId, rowIndex). */
function handleActiveStripDrop(
  payload: { type: 'CATALOG_MATCHUP' | 'GRID_MATCHUP'; matchUp: any },
  target: { courtId: string; rowIndex: number },
  refresh: () => void,
): void {
  const result = competitionEngine.competitionScheduleMatchUps({
    matchUpFilters: { scheduledDate: currentDate },
    withCourtGridRows: true,
    minCourtGridRows: scheduleConfig.get().minCourtGridRows,
  });
  const courtsData: any[] = result.courtsData ?? [];
  const court = courtsData.find((c) => c.courtId === target.courtId);
  if (!court) return;

  const courtOrder = target.rowIndex + 1;
  const methods: any[] = [];

  if (payload.type === 'GRID_MATCHUP') {
    methods.push({
      method: ADD_MATCHUP_SCHEDULE_ITEMS,
      params: {
        matchUpId: payload.matchUp.matchUpId,
        drawId: payload.matchUp.drawId ?? '',
        schedule: { scheduledTime: '', scheduledDate: '', courtOrder: '', venueId: '', courtId: '' },
        removePriorValues: true,
      },
    });
  }

  methods.push({
    method: ADD_MATCHUP_SCHEDULE_ITEMS,
    params: {
      matchUpId: payload.matchUp.matchUpId,
      drawId: payload.matchUp.drawId ?? '',
      schedule: {
        courtOrder,
        scheduledDate: currentDate,
        courtId: target.courtId,
        venueId: court.venueId,
      },
      removePriorValues: true,
    },
  });

  executeMethods(methods, refresh);
}

function buildCatalog(selectedDate: string): CatalogMatchUpItem[] {
  const { matchUps } = competitionEngine.allTournamentMatchUps({
    inContext: true,
    nextMatchUps: true,
  });

  return (matchUps || [])
    .filter((m: any) => m.matchUpStatus !== BYE)
    .map((m: any) => {
      const hasDate = !!m.schedule?.scheduledDate;
      const hasCourtAssignment = !!(m.schedule?.courtId && hasDate);
      const hasTimeAssignment = !!(m.schedule?.scheduledTime && hasDate);
      const isScheduled = hasCourtAssignment || hasTimeAssignment || hasDate;
      const onSelectedDate = m.schedule?.scheduledDate === selectedDate;

      return {
        matchUpId: m.matchUpId,
        eventId: m.eventId ?? '',
        eventName: m.eventName ?? '',
        drawId: m.drawId ?? '',
        drawName: m.drawName,
        structureId: m.structureId ?? '',
        roundNumber: m.roundNumber ?? 0,
        roundName: m.roundName,
        matchUpFormat: m.matchUpFormat,
        matchUpType: m.matchUpType,
        matchUpStatus: m.matchUpStatus,
        gender: m.gender,
        sides: (m.sides || []).map((s: any) => ({
          participantName: s.participant?.participantName ?? s.participantName,
          participantId: s.participantId ?? s.participant?.participantId,
          seedNumber: s.seedValue ?? s.seedNumber,
        })),
        isScheduled: isScheduled && onSelectedDate,
        scheduledTime: isScheduled ? m.schedule?.scheduledTime : undefined,
        scheduledCourtName: isScheduled ? m.schedule?.courtName : undefined,
      } satisfies CatalogMatchUpItem;
    });
}

export function buildScheduleDates(selectedDate: string): ScheduleDate[] {
  const { startDate, endDate } = competitionEngine.getCompetitionDateRange();
  const { tournamentInfo } = competitionEngine.getTournamentInfo();
  const activeDates = tournamentInfo?.activeDates;
  const dates = activeDates?.length ? activeDates : dateRange(startDate, endDate);

  const { matchUps } = competitionEngine.allTournamentMatchUps({ inContext: true });
  const dateCounts = new Map<string, number>();
  for (const m of matchUps || []) {
    const d = m.schedule?.scheduledDate;
    if (d) dateCounts.set(d, (dateCounts.get(d) || 0) + 1);
  }

  return dates.map((date: string) => ({
    date,
    isActive: date === selectedDate,
    matchUpCount: dateCounts.get(date) ?? 0,
  }));
}

/**
 * Apply issue severity indicators to court column headers and row number labels.
 * Uses a left border accent matching the cell issue colors.
 */
function applyHeaderRowIssueIndicators(
  courtHeaders: HTMLElement[],
  rowLabels: HTMLElement[],
  courtsData: any[],
  selectedDate: string,
): void {
  // Use allTournamentMatchUps for conflict detection (grid cell data lacks fields proConflicts needs)
  const { matchUps } = competitionEngine.allTournamentMatchUps({ inContext: true });
  const scheduledMatchUps = (matchUps || []).filter((m: any) => {
    return m.schedule?.courtId && m.schedule?.scheduledDate === selectedDate;
  });
  if (!scheduledMatchUps.length) return;

  const result = competitionEngine.proConflicts({ matchUps: scheduledMatchUps });
  if (result.error) return;

  const conflicts = { courtIssues: result.courtIssues || {}, rowIssues: result.rowIssues || {} };

  const { SCHEDULE_ERROR, SCHEDULE_CONFLICT, SCHEDULE_WARNING } = scheduleConstants;

  const severityColor = (issue: string): string => {
    if (issue === SCHEDULE_ERROR || issue === SCHEDULE_CONFLICT) return 'var(--sp-err, #f43f5e)';
    if (issue === SCHEDULE_WARNING) return 'var(--sp-warn, #f59e0b)';
    return 'var(--sp-accent, #3b82f6)';
  };

  // Semi-transparent tint for headers (they don't overlap scrolling content)
  const severityBg = (issue: string): string => {
    if (issue === SCHEDULE_ERROR || issue === SCHEDULE_CONFLICT) return 'rgba(244, 63, 94, 0.08)';
    if (issue === SCHEDULE_WARNING) return 'rgba(245, 158, 11, 0.06)';
    return 'rgba(59, 130, 246, 0.06)';
  };

  // Opaque tint for sticky row labels — layers a semi-transparent tint over the panel bg
  // so it works in both light and dark mode while hiding scrolling content behind it
  const severityBgOpaque = (issue: string): string => {
    const tint = severityBg(issue);
    return `linear-gradient(${tint}, ${tint}), var(--sp-panel-bg, #fff)`;
  };

  // Court headers: match courtId from courtsData to courtIssues keys
  for (let ci = 0; ci < courtHeaders.length; ci++) {
    const courtId = courtsData[ci]?.courtId;
    if (!courtId) continue;
    const issues = conflicts.courtIssues[courtId];
    if (!issues?.length) continue;
    // Use the highest severity issue
    const topIssue = issues[0].issue;
    courtHeaders[ci].style.borderBottom = `3px solid ${severityColor(topIssue)}`;
    courtHeaders[ci].style.background = severityBgOpaque(topIssue);
  }

  // Row labels: rowIssues keyed by row index
  const rowIssueEntries = conflicts.rowIssues || {};
  for (const [rowIdx, issues] of Object.entries(rowIssueEntries)) {
    const ri = Number.parseInt(rowIdx);
    if (Number.isNaN(ri) || ri >= rowLabels.length || !(issues as any[])?.length) continue;
    const topIssue = (issues as any[])[0].issue;
    rowLabels[ri].style.borderRight = `3px solid ${severityColor(topIssue)}`;
    rowLabels[ri].style.background = severityBgOpaque(topIssue);
  }
}

/**
 * Run proConflicts and annotate cellData objects with scheduleState, issueType,
 * and issueIds so that buildScheduleGridCell applies the correct CSS classes.
 */
function annotateConflicts(rows: any[], courtsData: any[], courtPrefix: string): void {
  // Collect all matchUp cellData objects from the grid
  const allCellData: any[] = [];
  for (const row of rows) {
    for (let ci = 0; ci < courtsData.length; ci++) {
      const cellData = row[`${courtPrefix}${ci}`];
      if (cellData?.matchUpId) allCellData.push(cellData);
    }
  }

  if (!allCellData.length) return;

  const { courtIssues, rowIssues } = competitionEngine.proConflicts({ matchUps: allCellData });

  // Build a map of matchUpId → issue details
  const matchUpIssueMap = new Map<string, any>();

  if (rowIssues) {
    const flatIssues = Array.isArray(rowIssues) ? rowIssues.flat() : Object.values(rowIssues).flat();
    for (const issue of flatIssues) {
      if (issue.matchUpId) {
        matchUpIssueMap.set(issue.matchUpId, issue);
      }
    }
  }

  if (courtIssues) {
    for (const issues of Object.values(courtIssues)) {
      for (const issue of issues as any[]) {
        if (issue.matchUpId && !matchUpIssueMap.has(issue.matchUpId)) {
          matchUpIssueMap.set(issue.matchUpId, issue);
        }
      }
    }
  }

  // Annotate each cellData with the issue info that mapMatchUpToCellData reads
  for (const cellData of allCellData) {
    const issue = matchUpIssueMap.get(cellData.matchUpId);
    if (issue) {
      cellData.scheduleState = issue.issue;
      cellData.issueType = issue.issueType;
      cellData.issueIds = issue.issueIds;
    } else {
      delete cellData.scheduleState;
      delete cellData.issueType;
      delete cellData.issueIds;
    }
  }
}

function buildIssueEntry(
  issue: any,
  mapSeverity: (issue: string) => ScheduleIssueSeverity,
  labelFn: (id: string) => string,
  selectedDate: string,
  prefix?: string,
): ScheduleIssue {
  const participants = labelFn(issue.matchUpId);
  const conflictLabels = (issue.issueIds || []).map((id: string) => labelFn(id));
  const messagePrefix = prefix || '';
  return {
    severity: mapSeverity(issue.issue),
    message: `${messagePrefix}${issue.issueType}: ${participants}${conflictLabels.length ? ' conflicts with ' + conflictLabels.join(', ') : ''}`,
    issueType: issue.issueType,
    ...(prefix && { prefix }),
    participants,
    conflictParticipants: conflictLabels.length ? conflictLabels : undefined,
    conflictMatchUpIds: issue.issueIds?.length ? [issue.matchUpId, ...issue.issueIds] : undefined,
    matchUpId: issue.matchUpId,
    date: selectedDate,
  };
}

export function buildIssues(selectedDate: string): ScheduleIssue[] {
  // Always use allTournamentMatchUps for conflict detection — the grid cell data objects
  // lack fields that proConflicts needs to detect certain conflict types.
  const { matchUps } = competitionEngine.allTournamentMatchUps({ inContext: true });
  const scheduledMatchUps = (matchUps || []).filter((m: any) => {
    return m.schedule?.courtId && m.schedule?.scheduledDate === selectedDate;
  });
  if (!scheduledMatchUps.length) return [];

  const conflictResult = competitionEngine.proConflicts({ matchUps: scheduledMatchUps });
  if (conflictResult.error) return [];
  const conflictsResult = { courtIssues: conflictResult.courtIssues || {}, rowIssues: conflictResult.rowIssues || {} };

  const { SCHEDULE_ERROR, SCHEDULE_CONFLICT, SCHEDULE_WARNING, SCHEDULE_ISSUE } = scheduleConstants;

  const mapSeverity = (issue: string): ScheduleIssueSeverity => {
    if (issue === SCHEDULE_ERROR) return 'ERROR';
    if (issue === SCHEDULE_CONFLICT) return 'ERROR';
    if (issue === SCHEDULE_WARNING) return 'WARN';
    if (issue === SCHEDULE_ISSUE) return 'INFO';
    return 'WARN';
  };

  // Build lookup from matchUpId to participant display string
  const matchUpLabel = (id: string): string => {
    const m = scheduledMatchUps.find((mu: any) => mu.matchUpId === id);
    if (!m) return 'Unknown';
    const names = (m.sides || []).map((s: any) => s.participant?.participantName ?? s.participantName).filter(Boolean);
    return names.length ? names.join(' vs ') : m.roundName || 'TBD vs TBD';
  };

  const issues: ScheduleIssue[] = [];

  // Deduplicate: for mirror pairs (A conflicts with B, B conflicts with A),
  // keep only the first occurrence by tracking seen matchUpId pairs.
  const seenPairs = new Set<string>();
  const dedupKey = (mid: string, ids: string[]): string => {
    const sorted = [mid, ...ids].sort((a, b) => a.localeCompare(b));
    return sorted.join('|');
  };

  for (const [, courtIssues] of Object.entries(conflictsResult.courtIssues || {})) {
    for (const ci of courtIssues as any[]) {
      const key = dedupKey(ci.matchUpId, ci.issueIds || []);
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      issues.push(buildIssueEntry(ci, mapSeverity, matchUpLabel, selectedDate));
    }
  }

  for (const [rowIdx, rowIssues] of Object.entries(conflictsResult.rowIssues || {})) {
    for (const ri of rowIssues as any[]) {
      const key = dedupKey(ri.matchUpId, ri.issueIds || []);
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      const rowPrefix = `Row ${Number.parseInt(rowIdx) + 1}: `;
      issues.push(buildIssueEntry(ri, mapSeverity, matchUpLabel, selectedDate, rowPrefix));
    }
  }

  return issues;
}

// ── Helpers ──

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
