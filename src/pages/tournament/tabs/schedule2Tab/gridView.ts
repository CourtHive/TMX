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
import { competitionEngine, tournamentEngine } from 'services/factory/engine';
import { confirmModal } from 'components/modals/baseModal/baseModal';
import {
  matchUpStatusConstants,
  factoryConstants,
  tools,
  unwrapOr,
  AvailabilityEngine,
} from 'tods-competition-factory';
import { getActiveRegistrationNamesByCourtId } from './practiceRegistrationStrip';
import { buildGridDropMethods, shouldRejectStripDrop, type GridDropPayload } from './gridDropMethods';
import { detectCourtTimeOrderIssues, CONFLICT_COURT_TIME_ORDER } from './courtTimeOrderIssues';
import { handleSchedule2CellClick, handleSchedule2RowClick } from './schedule2CellActions';
import { printCourtMatchUpCards } from 'components/modals/printCourtCards';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { renameCourt } from 'components/modals/renameCourt';
import { scheduleToast } from './scheduleToast';
import { scheduleConfig } from 'config/scheduleConfig';
import { tipster } from 'components/popovers/tipster';
import { tmx2db } from 'services/storage/tmx2db';
import { context } from 'services/context';
import tippy, { type Instance } from 'tippy.js';
import { t } from 'i18n';
import { readScheduleDisplayConfig } from 'services/schedulePreferences/scheduleDisplayExtension';
import { readUserMinCourtWidth, writeUserMinCourtWidth } from 'services/schedulePreferences/userMinCourtWidth';
import { buildGridActionBar } from './gridActionBar';
import {
  invalidateMatchUpCaches,
  getCachedScheduleMatchUps,
  getCachedCompetitionDateRange,
  getCachedTournamentInfo,
  getCachedAllMatchUps,
} from './schedule2DataCache';
import {
  createSchedulePage,
  buildScheduleGridCell,
  mapMatchUpToCellData,
  DEFAULT_SCHEDULE_CELL_CONFIG,
  matchUpLabel,
  filterMatchUpCatalog,
  computeBaseRoundByEvent,
  groupMatchUpCatalog,
  isCompletedStatus,
  buildActiveStripPanel,
  buildMatchUpCard,
  wrapSearchWithClear,
} from 'courthive-components';
import type {
  SchedulePageConfig,
  SchedulePageControl,
  CatalogMatchUpItem,
  CatalogFilters,
  MatchUpCatalogGroupBy,
  ScheduleDate,
  ScheduleIssue,
  ScheduleIssueSeverity,
  ActiveStripPanel,
  ActiveStripPanelData,
  ActiveStripCourtBlock,
} from 'courthive-components';

// constants
import { COMPETITION_ENGINE, MINIMUM_SCHEDULE_COLUMNS } from 'constants/tmxConstants';
import { ADD_MATCHUP_SCHEDULE_ITEMS, SET_MATCHUP_CALLED_AT } from 'constants/mutationConstants';
import { addVenue } from 'pages/tournament/tabs/venuesTab/addVenue';
import { hiddenCourtIds, syncVisibilityDate } from './visibilityState';

const { scheduleConstants } = factoryConstants;

const { BYE } = matchUpStatusConstants;

/**
 * Fallback row count when a tournament hasn't yet had its scheduleDisplay
 * extension set via the in-grid Rows stepper. Used to seed the very first
 * render and any code path that doesn't pull from the extension. Exported
 * so the header (which renders the stepper) can seed its initial display
 * from the same value.
 */
export const DEFAULT_MIN_COURT_GRID_ROWS = 10;

// Class applied to a filter <select> and its preceding label inside the
// scheduled-panel filter popover when the select carries a non-empty value.
// Mirrors `FILTERING_CLASS` inside the unscheduled `matchUpCatalog` widget
// so the visual highlight is consistent across the two panels.
const FILTER_HIGHLIGHT_CLASS = 'is-filtering';

const DATA_COURT_ID = 'data-court-id';
const DATA_VENUE_ID = 'data-venue-id';
const DATA_COURT_ORDER = 'data-court-order';
const DATA_MATCHUP_ID = 'data-matchup-id';
const DATA_DRAW_ID = 'data-draw-id';
const DATA_SCHEDULED_TIME = 'data-scheduled-time';
const INTENT_WARNING = 'is-warning';
// Custom drag MIME marker — present only on grid-sourced drags. The payload
// itself is unreadable mid-drag (browsers block getData during dragover), but
// dataTransfer.types is readable, so this marker lets the Now-strip affordance
// tell a grid drag from a catalog drag while hovering.
const GRID_DRAG_MARKER = 'application/x-tmx-grid-matchup';
const STRIP_CELL_CLASS = 'spl-active-strip-cell';
const STRIP_FREE_CLASS = 'state-free';
const DROP_OVER_CLASS = 'drop-over';
const STRIP_DROP_BLOCKED_CLASS = 'tmx-strip-drop-blocked';
const POSITION_STICKY = 'position: sticky';
const FONT_SIZE_11 = 'font-size: 0.6875rem';
const DISPLAY_FLEX = 'display: flex';

// Grid layout constants — shared with the active strip so its leading spacer
// matches the row-number column and its court cells align with grid columns.
// The minimum court column width is a user preference (readUserMinCourtWidth)
// adjustable from the footer stepper, NOT a constant.
const GRID_TIME_COL_WIDTH_PX = 50;
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
let activeStripBlockTicker: ReturnType<typeof setInterval> | null = null;
let catalogStateUnsubscribe: (() => void) | null = null;
// Persisted view state (sidebar tab + scheduled-panel search / groupBy /
// filters) lives in `gridViewStorage.ts` — extracted so the localStorage
// round-trips + default / malformed paths can be unit-tested without
// spinning up this entire module.
import {
  readSidebarTab,
  writeSidebarTab,
  readScheduledSearch,
  writeScheduledSearch,
  readScheduledGroupBy,
  writeScheduledGroupBy,
  readScheduledFilters,
  writeScheduledFilters,
  type SidebarTab,
} from './gridViewStorage';

/** Distinct, sorted, locale-aware values of an accessor across catalog items.
 *  Mirrors the helper inside courthive-components' `matchUpCatalog.ts`. */
function uniqueCatalogValues(
  items: CatalogMatchUpItem[],
  fn: (item: CatalogMatchUpItem) => string | undefined,
): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const v = fn(item);
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
// Latest schedule snapshot used by the strip — also consulted by the strip's
// click handler so popovers open against the same row data the cell renders.
let latestStripSnapshot: { rows: any[]; courtPrefix: string; courtsData: any[] } | null = null;

export function renderGridView(
  container: HTMLElement,
  scheduledDate: string,
  options?: {
    headerActions?: HTMLElement[];
    titleLeadingActions?: HTMLElement[];
    titleSlot?: HTMLElement;
    activeStripVisible?: boolean;
    bulkMode?: boolean;
    onBulkModeChange?: (enabled: boolean) => void;
    onClearSchedule?: (target: HTMLElement) => void;
  },
): void {
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
      onMatchUpDrop: (payload, target, event) => {
        handleActiveStripDrop(payload, target, refresh, event);
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
  attachStripDropAffordance(activeStrip.element);

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
    headerActions: options?.headerActions,
    titleLeadingActions: options?.titleLeadingActions,
    titleSlot: options?.titleSlot,
    // Seed the store with the persisted visibility so the very first click
    // dispatches a real state change (default-true store + false-localStorage
    // otherwise causes a no-op on first toggle).
    activeStripVisible: options?.activeStripVisible ?? true,
    // Restore catalog filter state captured from a previous mount within
    // this tournament session. Cleared on tournament load (see loadTournament).
    initialCatalogState: context.scheduleCatalogState,
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

      const existingMatchUpId = target?.getAttribute(DATA_MATCHUP_ID);
      const existingDrawId = target?.getAttribute(DATA_DRAW_ID);

      const methods = buildGridDropMethods({
        payload: payload as unknown as GridDropPayload,
        target: {
          courtId,
          venueId,
          courtOrder: Number.parseInt(courtOrder, 10),
          scheduledTime: target?.getAttribute(DATA_SCHEDULED_TIME) ?? undefined,
        },
        occupant: existingMatchUpId ? { matchUpId: existingMatchUpId, drawId: existingDrawId ?? undefined } : null,
        scheduledDate: currentDate,
      });

      if (methods.length) executeMethods(methods, refresh);
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
        // Explicit unschedule — clear any prior active-strip "called" stamp.
        {
          method: SET_MATCHUP_CALLED_AT,
          params: { matchUpId, drawId: item?.drawId ?? '', calledAt: null },
        },
      ];

      executeMethods(methods, refresh);
    },

    onMatchUpSelected: () => {
      // Selection is a UI-only concern in the schedule page right now —
      // no global state update needed. Keep the hook so the catalog can
      // surface selection later (e.g. via an inspector panel).
    },
  };

  // Mount the schedule page inside a flex-column wrapper so a bottom
  // action bar (Issues / Bulk mode / Clear) can sit below the panel —
  // mirrors the profile view's action-bar pattern. Without the wrapper,
  // #schedule2Container is plain block layout and the bar would push
  // outside the fixed-height viewport.
  const panelWrapper = document.createElement('div');
  panelWrapper.style.cssText = 'display: flex; flex-direction: column; height: 100%; overflow: hidden;';
  container.appendChild(panelWrapper);

  const panelArea = document.createElement('div');
  panelArea.style.cssText = 'flex: 1; min-height: 0; overflow: hidden;';
  panelWrapper.appendChild(panelArea);

  activeControl = createSchedulePage(config, panelArea);

  // Action bar — always rendered; it owns the min-width stepper even when
  // there are no issues / no bulk toggle / no clear menu. The provider
  // permission check inside buildGridActionBar decides whether the bulk
  // toggle appears.
  const actionBar = buildGridActionBar({
    issues,
    bulkMode: options?.bulkMode ?? false,
    minCourtWidth: readUserMinCourtWidth(),
    onMinCourtWidthChange: (width) => {
      writeUserMinCourtWidth(width);
      refresh();
    },
    onBulkModeChange: options?.onBulkModeChange ?? (() => undefined),
    onClearSchedule: options?.onClearSchedule,
  });
  panelWrapper.appendChild(actionBar);

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

  // Capture catalog filter changes into context so they survive tab navigation
  // within the same tournament. Cleared on tournament load (see loadTournament
  // in tournamentDisplay.ts). Stored as a fresh object reference on every
  // change so the next renderGridView seeds from the latest snapshot.
  catalogStateUnsubscribe = activeControl.getStore().subscribe((nextState) => {
    context.scheduleCatalogState = {
      catalogSearchQuery: nextState.catalogSearchQuery,
      catalogGroupBy: nextState.catalogGroupBy,
      catalogFilters: nextState.catalogFilters,
      showCompleted: nextState.showCompleted,
      showScheduled: nextState.showScheduled,
    };
  });
  const initialState = activeControl.getStore().getState();
  activeStrip.update(initialState);
  syncStripOffset(initialState.activeStripVisible);
  activeStrip.setData(buildActiveStripData(currentDate));

  // Periodic refresh of just the courtBlocks portion so availability blocks
  // (PRACTICE / MAINTENANCE / etc.) appear and disappear with the clock.
  // 30s cadence trades a small re-render cost for ~30s worst-case lag.
  if (activeStripBlockTicker) clearInterval(activeStripBlockTicker);
  activeStripBlockTicker = setInterval(() => {
    if (!activeStrip) return;
    activeStrip.setData(buildActiveStripData(currentDate));
  }, 30000);

  // Strip cell clicks open the same popover as grid-cell clicks. Delegated
  // listener so it survives the strip's render() rebuilds.
  activeStrip.element.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement | null)?.closest('.spl-active-strip-cell') as HTMLElement | null;
    if (!target) return;
    handleStripCellClick(e as MouseEvent, target, refresh);
  });

  // ── Inject sidebar controls: collapse toggle + Unscheduled/Scheduled tabs ──
  injectSidebarControls(container, refresh);
}

// ============================================================================
// Sidebar Controls (collapse + scheduled matchUp list)
// ============================================================================

function injectSidebarControls(container: HTMLElement, refresh: () => void): void {
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
  unschedTab.dataset.sidebarTab = 'unscheduled';
  const schedTab = document.createElement('button');
  schedTab.dataset.sidebarTab = 'scheduled';
  const tabStyle = (active: boolean) =>
    [
      FONT_SIZE_11,
      'padding: 3px 8px',
      'border-radius: 10px',
      'cursor: pointer',
      'border: 1px solid transparent',
      'white-space: nowrap',
      active
        ? 'background: var(--tmx-fill-accent, #2563eb); color: #fff; font-weight: 600;'
        : 'background: var(--sp-chip-bg, rgba(128,128,128,0.12)); color: inherit;',
    ].join('; ');
  // Both Unscheduled and Scheduled tabs carry an inline (n) count badge —
  // populated on initial render and refreshed whenever the store ticks. The
  // badges give operators an at-a-glance hint of how much work remains on
  // each side without switching tabs. Translucent-white background reads
  // legibly against both the active (blue) and inactive (gray) tab fills.
  const badgeCss =
    'display: inline-block; font-size: 0.625rem; font-weight: 700; padding: 0 6px; border-radius: 9px; background: rgba(255,255,255,0.25); color: inherit; min-width: 16px; text-align: center;';

  unschedTab.textContent = t('schedule.unscheduled');
  unschedTab.appendChild(document.createTextNode(' '));
  const unschedBadge = document.createElement('span');
  unschedBadge.style.cssText = badgeCss;
  unschedBadge.textContent = '0';
  unschedTab.appendChild(unschedBadge);

  schedTab.textContent = t('schedule.scheduled');
  schedTab.appendChild(document.createTextNode(' '));
  const schedBadge = document.createElement('span');
  schedBadge.style.cssText = badgeCss;
  schedBadge.textContent = '0';
  schedTab.appendChild(schedBadge);

  controlBar.appendChild(unschedTab);
  controlBar.appendChild(schedTab);

  // Scheduled matchUp list container — same DOM layout as the unscheduled
  // catalog widget (header with title + filter icon, toolbar with search +
  // group-by select, body with grouped cards) so the two panels read as
  // sibling surfaces rather than two different designs.
  const scheduledPanel = document.createElement('div');
  scheduledPanel.dataset.sidebarPanel = 'scheduled';
  scheduledPanel.style.cssText = 'display: none; flex: 1; min-height: 0; flex-direction: column;';

  let scheduledSearchQuery = readScheduledSearch();
  let scheduledGroupBy: MatchUpCatalogGroupBy = readScheduledGroupBy();
  let scheduledFilters: CatalogFilters = readScheduledFilters();
  let scheduledFilterTip: Instance | undefined;
  const scheduledCollapsedGroups = new Set<string>();

  // Header (title row with filter icon on the right, then a meta row below).
  // Mirrors the unscheduled catalog's `sp-panel-header > spl-catalog-title-row`
  // structure so the visual treatment matches without redeclaring styles.
  const scheduledHeader = document.createElement('div');
  scheduledHeader.className = 'sp-panel-header';
  const scheduledTitleRow = document.createElement('div');
  scheduledTitleRow.className = 'spl-catalog-title-row';
  const scheduledTitle = document.createElement('div');
  scheduledTitle.className = 'sp-panel-title';
  scheduledTitle.textContent = t('schedule.scheduledTitle');

  const scheduledFilterBtn = document.createElement('button');
  scheduledFilterBtn.className = 'spl-catalog-filter-btn';
  scheduledFilterBtn.title = t('schedule.filterMatchUps');
  scheduledFilterBtn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';

  scheduledTitleRow.appendChild(scheduledTitle);
  scheduledTitleRow.appendChild(scheduledFilterBtn);

  const scheduledMeta = document.createElement('div');
  scheduledMeta.className = 'sp-panel-meta';

  scheduledHeader.appendChild(scheduledTitleRow);
  scheduledHeader.appendChild(scheduledMeta);
  scheduledPanel.appendChild(scheduledHeader);

  // Toolbar — search + group-by select (no filter button; filter lives in the
  // header row above, matching the unscheduled catalog).
  const scheduledToolbar = document.createElement('div');
  scheduledToolbar.className = 'sp-catalog-toolbar';

  const scheduledSearchInput = document.createElement('input');
  scheduledSearchInput.type = 'text';
  scheduledSearchInput.className = 'sp-input';
  scheduledSearchInput.placeholder = t('schedule.searchScheduledMatchUps');
  scheduledSearchInput.value = scheduledSearchQuery;
  scheduledSearchInput.addEventListener('input', () => {
    scheduledSearchQuery = scheduledSearchInput.value;
    writeScheduledSearch(scheduledSearchQuery);
    updateScheduledPanel();
  });

  const scheduledSearchWrap = wrapSearchWithClear(scheduledSearchInput, () => {
    scheduledSearchInput.value = '';
    scheduledSearchQuery = '';
    writeScheduledSearch('');
    scheduledSearchInput.focus();
    updateScheduledPanel();
  });

  const scheduledGroupSelect = document.createElement('select');
  scheduledGroupSelect.className = 'sp-select';
  for (const [val, label] of [
    ['time', t('schedule.groupBy.time')],
    ['event', t('schedule.groupBy.event')],
    ['draw', t('schedule.groupBy.draw')],
    ['round', t('schedule.groupBy.round')],
    ['structure', t('schedule.groupBy.structure')],
  ] as const) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    if (val === scheduledGroupBy) opt.selected = true;
    scheduledGroupSelect.appendChild(opt);
  }
  scheduledGroupSelect.addEventListener('change', () => {
    scheduledGroupBy = scheduledGroupSelect.value as MatchUpCatalogGroupBy;
    writeScheduledGroupBy(scheduledGroupBy);
    // Group identity changes when the grouping mode changes; clear the
    // collapsed-groups set so the new grouping doesn't start half-collapsed
    // based on stale keys from the previous mode.
    scheduledCollapsedGroups.clear();
    updateScheduledPanel();
  });

  scheduledToolbar.appendChild(scheduledSearchWrap);
  scheduledToolbar.appendChild(scheduledGroupSelect);
  scheduledPanel.appendChild(scheduledToolbar);

  // Cards container — re-populated each `updateScheduledPanel` call.
  const scheduledCardsContainer = document.createElement('div');
  scheduledCardsContainer.className = 'sp-catalog';
  scheduledCardsContainer.style.cssText = 'flex: 1; min-height: 0;';
  scheduledPanel.appendChild(scheduledCardsContainer);

  function isAnyScheduledFilterActive(): boolean {
    return !!(
      scheduledFilters.eventType ||
      scheduledFilters.eventName ||
      scheduledFilters.drawName ||
      scheduledFilters.gender ||
      scheduledFilters.roundName
    );
  }

  function updateScheduledFilterBadge(): void {
    scheduledFilterBtn.classList.toggle('active', isAnyScheduledFilterActive());
  }
  updateScheduledFilterBadge();

  function destroyScheduledFilterTip(): void {
    if (scheduledFilterTip) {
      scheduledFilterTip.destroy();
      scheduledFilterTip = undefined;
    }
  }

  function buildScheduledFilterPopover(): HTMLElement {
    // Build option lists from the unfiltered catalog source for the current
    // date so the popover always offers every available value — filtering
    // by one dimension shouldn't shrink the choices on the others.
    const items = getScheduledNotPlacedOnCourt().map((m) => scheduledMatchUpToCatalogItem(m));

    const container = document.createElement('div');
    container.className = 'spl-filter-popover';

    const popoverHeader = document.createElement('div');
    popoverHeader.className = 'spl-filter-header';

    const clearAll = document.createElement('button');
    clearAll.className = 'spl-filter-clear-btn';
    clearAll.textContent = t('schedule.filterClearAll');
    clearAll.addEventListener('click', (ev) => {
      ev.stopPropagation();
      scheduledFilters = {};
      writeScheduledFilters(scheduledFilters);
      updateScheduledFilterBadge();
      for (const sel of container.querySelectorAll<HTMLSelectElement>('select')) {
        sel.value = '';
        sel.classList.remove(FILTER_HIGHLIGHT_CLASS);
        const lbl = sel.previousElementSibling;
        if (lbl?.classList.contains('spl-filter-label')) lbl.classList.remove(FILTER_HIGHLIGHT_CLASS);
      }
      updateScheduledPanel();
    });
    popoverHeader.appendChild(clearAll);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'spl-filter-close-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      destroyScheduledFilterTip();
    });
    popoverHeader.appendChild(closeBtn);

    container.appendChild(popoverHeader);

    const sections: Array<{ labelKey: string; key: keyof CatalogFilters; values: string[] }> = [
      {
        labelKey: 'schedule.filterAllEventTypes',
        key: 'eventType',
        values: uniqueCatalogValues(items, (m) => m.matchUpType),
      },
      {
        labelKey: 'schedule.filterAllEvents',
        key: 'eventName',
        values: uniqueCatalogValues(items, (m) => m.eventName),
      },
      { labelKey: 'schedule.filterAllFlights', key: 'drawName', values: uniqueCatalogValues(items, (m) => m.drawName) },
      { labelKey: 'schedule.filterAllGenders', key: 'gender', values: uniqueCatalogValues(items, (m) => m.gender) },
      {
        labelKey: 'schedule.filterAllRounds',
        key: 'roundName',
        values: uniqueCatalogValues(items, (m) => m.roundName),
      },
    ];

    for (const section of sections) {
      if (section.values.length < 2) continue;

      const label = document.createElement('label');
      label.className = 'spl-filter-label';
      label.textContent = t(section.labelKey);
      container.appendChild(label);

      const select = document.createElement('select');
      select.className = 'spl-filter-select';

      const allOpt = document.createElement('option');
      allOpt.value = '';
      allOpt.textContent = t(section.labelKey);
      select.appendChild(allOpt);

      for (const val of section.values) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        select.appendChild(opt);
      }

      select.value = scheduledFilters[section.key] ?? '';

      const syncHighlight = () => {
        const filtering = select.value !== '';
        select.classList.toggle(FILTER_HIGHLIGHT_CLASS, filtering);
        label.classList.toggle(FILTER_HIGHLIGHT_CLASS, filtering);
      };
      syncHighlight();

      select.addEventListener('change', () => {
        scheduledFilters = { ...scheduledFilters, [section.key]: select.value || undefined };
        writeScheduledFilters(scheduledFilters);
        updateScheduledFilterBadge();
        syncHighlight();
        updateScheduledPanel();
      });

      container.appendChild(select);
    }

    // "Show completed" toggle — always rendered so the popover has at
    // least one functional control. Without it, dates where every orphan
    // is completed (e.g. the morning after a finished day whose courts
    // were cleared) produced an empty Clear All / × husk. Writes to the
    // shared store flag so this and the Unscheduled-side toggle stay in
    // lockstep — one mental model, one switch.
    const toggleRow = document.createElement('label');
    toggleRow.className = 'spl-filter-toggle';
    const showCompletedCheckbox = document.createElement('input');
    showCompletedCheckbox.type = 'checkbox';
    showCompletedCheckbox.checked = activeControl?.getStore().getState().showCompleted ?? false;
    showCompletedCheckbox.addEventListener('change', () => {
      activeControl?.getStore().setShowCompleted(showCompletedCheckbox.checked);
    });
    toggleRow.appendChild(showCompletedCheckbox);
    toggleRow.appendChild(document.createTextNode(` ${t('schedule.showCompleted')}`));
    container.appendChild(toggleRow);

    return container;
  }

  scheduledFilterBtn.addEventListener('click', () => {
    destroyScheduledFilterTip();
    scheduledFilterTip = tippy(scheduledFilterBtn, {
      content: buildScheduledFilterPopover(),
      placement: 'bottom-start',
      interactive: true,
      trigger: 'manual',
      appendTo: () => scheduledPanel,
      onClickOutside: () => destroyScheduledFilterTip(),
      theme: '',
    });
    scheduledFilterTip.show();
  });

  // The component's existing catalog content (everything after the control bar)
  const catalogContent = Array.from(sidebar.children);

  // Insert control bar at top
  sidebar.insertBefore(controlBar, sidebar.firstChild);
  sidebar.appendChild(scheduledPanel);

  let activeTab: SidebarTab = readSidebarTab();

  // Single source of truth for "scheduled but not placed" — used by both the
  // panel renderer and the tab badge so they cannot drift. Sorted by
  // scheduledTime ascending (no-time entries fall to the bottom) so that
  // the list reflects the play order produced by the scheduler, with a
  // stable tie-break on matchUpId.
  // Orphans = scheduled-for-this-date, no court assigned, not BYE. Completion
  // status is NOT filtered here — callers decide based on the operator's
  // "Show completed" toggle. Splitting the call this way lets `updateBadge`
  // compute both the visible count (respects toggle) and the absolute count
  // (drives funnel visibility) from one factory call.
  function listScheduledOrphans(): any[] {
    const { matchUps } = getCachedAllMatchUps();
    const filtered = (matchUps || []).filter((m: any) => {
      if (m.matchUpStatus === BYE) return false;
      if (m.schedule?.scheduledDate !== currentDate) return false;
      if (m.schedule?.courtId) return false; // already on a court — don't show
      return true; // date match is sufficient — time is optional
    });
    filtered.sort((a: any, b: any) => {
      const am = scheduledTimeToMinutes(a.schedule?.scheduledTime);
      const bm = scheduledTimeToMinutes(b.schedule?.scheduledTime);
      if (am !== bm) return am - bm;
      return String(a.matchUpId).localeCompare(String(b.matchUpId));
    });
    return filtered;
  }

  function getScheduledNotPlacedOnCourt(): any[] {
    // Honors the shared "Show completed" store flag so a completed matchUp
    // whose court was cleared (manual unschedule or upstream sync wiping
    // courtId while preserving scheduledDate/scheduledTime) has a surface
    // to be re-assigned from — without the toggle, it had nowhere to live.
    const showCompleted = activeControl?.getStore().getState().showCompleted ?? false;
    const all = listScheduledOrphans();
    return showCompleted ? all : all.filter((m: any) => !isCompletedStatus(m.matchUpStatus));
  }

  function updateBadge(): void {
    // Single factory pass; split into visible-count (respects the toggle)
    // and absolute-count (gates funnel visibility). The funnel is hidden
    // when there's nothing for the popover to act on even with the toggle
    // on — otherwise opening it surfaces an empty Clear All / × husk.
    const orphans = listScheduledOrphans();
    const showCompleted = activeControl?.getStore().getState().showCompleted ?? false;
    const visibleCount = showCompleted
      ? orphans.length
      : orphans.filter((m: any) => !isCompletedStatus(m.matchUpStatus)).length;
    schedBadge.textContent = String(visibleCount);
    scheduledFilterBtn.style.display = orphans.length === 0 ? 'none' : '';
    // Unscheduled badge reflects the unfiltered eligible-for-unscheduled
    // count for the current date — same source the catalog widget meta
    // shows ("X unscheduled"), so the badge cannot drift from what the
    // catalog itself displays. Computed from `buildCatalog(currentDate)`
    // to share the same date / completed / BYE filtering with the catalog
    // body so the two stay aligned.
    const unscheduledCount = buildCatalog(currentDate).filter((item) => !item.isScheduled).length;
    unschedBadge.textContent = String(unscheduledCount);
  }

  function updateScheduledPanel(): void {
    scheduledCardsContainer.innerHTML = '';
    const scheduled = getScheduledNotPlacedOnCourt();
    const items = scheduled.map((m) => scheduledMatchUpToCatalogItem(m));

    // Round-emphasis base per event — computed off the FULL items list
    // (pre-filter) so the offset assigned to a card stays stable as the
    // operator types in the search box. Shares the canonical
    // `computeBaseRoundByEvent` helper with the courthive-components
    // catalog widget on the Unscheduled side; before extraction TMX and
    // courthive-components each had their own inlined copy.
    const baseRoundByEvent = computeBaseRoundByEvent(items);

    // Same filter + group pipeline the unscheduled catalog runs. `behavior:
    // 'hide'` would normally drop items where `isScheduled === true`, but
    // `scheduledMatchUpToCatalogItem` already forces `isScheduled: false`
    // (so the card stays draggable), so behavior is a no-op here — explicit
    // 'dim' avoids the hide branch entirely.
    // showCompleted MUST be threaded through: `getScheduledNotPlacedOnCourt`
    // honors it (so completed orphans reach this step), but
    // `filterMatchUpCatalog` re-applies `isCompletedStatus` internally and
    // would drop them again if we left the default `false`.
    const showCompleted = activeControl?.getStore().getState().showCompleted ?? false;
    const filtered = filterMatchUpCatalog(items, scheduledSearchQuery, 'dim', scheduledFilters, showCompleted);

    // Match the unscheduled catalog meta line ("{N} unscheduled") on the
    // Scheduled side so the panel header carries the same shape and the
    // count reflects the active search + filter.
    scheduledMeta.textContent = t('schedule.scheduledCount', { count: filtered.length });

    if (!scheduled.length) {
      const hint = document.createElement('div');
      hint.style.cssText =
        'font-size: 0.6875rem; color: var(--sp-muted, var(--tmx-muted)); text-align: center; padding: 24px 8px;';
      hint.textContent = t('schedule.noScheduledMatchUps');
      scheduledCardsContainer.appendChild(hint);
      return;
    }

    if (!filtered.length) {
      const hint = document.createElement('div');
      hint.style.cssText =
        'font-size: 0.6875rem; color: var(--sp-muted, var(--tmx-muted)); text-align: center; padding: 24px 8px;';
      hint.textContent = t('schedule.noScheduledMatchUpsMatch');
      scheduledCardsContainer.appendChild(hint);
      return;
    }

    const groups = groupMatchUpCatalog(filtered, scheduledGroupBy);

    for (const [gk, groupItems] of groups) {
      const groupEl = document.createElement('div');
      groupEl.className = 'sp-group';

      const isCollapsed = scheduledCollapsedGroups.has(gk);

      const gh = document.createElement('div');
      gh.className = 'sp-group-header';

      const chevron = document.createElement('span');
      chevron.className = 'sp-group-chevron';
      chevron.textContent = isCollapsed ? '▶' : '▼';

      const ghLabel = document.createElement('span');
      ghLabel.textContent = `${gk} (${groupItems.length})`;

      gh.appendChild(chevron);
      gh.appendChild(ghLabel);

      gh.addEventListener('click', () => {
        if (scheduledCollapsedGroups.has(gk)) scheduledCollapsedGroups.delete(gk);
        else scheduledCollapsedGroups.add(gk);
        updateScheduledPanel();
      });

      const gb = document.createElement('div');
      gb.className = 'sp-group-body';
      if (isCollapsed) gb.style.display = 'none';

      for (const item of groupItems) {
        // isScheduled is forced to false so buildMatchUpCard attaches its
        // dragstart listener — these sidebar cards must be promotable onto a
        // court. The prominent time header (via the option) is what visually
        // marks them as already having a scheduledTime.
        // Round-offset is computed against the pre-filter `items` set so the
        // visual priority stays stable while the operator searches.
        const base = baseRoundByEvent.get(item.eventId);
        const roundOffset = base !== undefined ? Math.max(0, item.roundNumber - base) : undefined;
        const card = buildMatchUpCard(item, {}, { prominentTime: true, roundOffset });
        if (!item.scheduledTime) card.classList.add('no-time');
        gb.appendChild(card);
      }

      groupEl.appendChild(gh);
      groupEl.appendChild(gb);
      scheduledCardsContainer.appendChild(groupEl);
    }
  }

  function setTab(tab: SidebarTab): void {
    activeTab = tab;
    writeSidebarTab(tab);
    unschedTab.style.cssText = tabStyle(tab === 'unscheduled');
    schedTab.style.cssText = tabStyle(tab === 'scheduled');

    if (tab === 'unscheduled') {
      scheduledPanel.style.display = 'none';
      for (const el of catalogContent) (el as HTMLElement).style.display = '';
    } else {
      for (const el of catalogContent) (el as HTMLElement).style.display = 'none';
      // Explicit `flex` rather than `''` so the panel's flex-direction:column
      // takes effect (default `block` would stack the search bar above the
      // cards container without honoring the flex layout).
      scheduledPanel.style.display = 'flex';
      updateScheduledPanel();
    }
  }

  unschedTab.addEventListener('click', () => setTab('unscheduled'));
  schedTab.addEventListener('click', () => setTab('scheduled'));

  // Drop-to-unschedule: dragging a placed matchUp onto the Scheduled tab or
  // its panel removes the court assignment. If the matchUp has a scheduled
  // time it stays in the Scheduled list; if it has no time it routes back
  // to Unscheduled. Without this, the only way to free a court was to
  // switch tabs and drop on Unscheduled.
  attachUnscheduleDropTarget(schedTab, refresh);
  attachUnscheduleDropTarget(scheduledPanel, refresh);

  // Apply the persisted tab (also restores Scheduled view + populates panel
  // on a date change when the user was already on the Scheduled tab).
  setTab(activeTab);
  updateBadge();

  // Hook into refresh to update scheduled panel when visible. The badge
  // updates regardless of which tab is active so operators can see the
  // count grow after running the scheduler without switching tabs.
  const origRefresh = activeControl?.getStore().subscribe(() => {
    updateBadge();
    if (activeTab === 'scheduled') updateScheduledPanel();
  });
  // Store unsubscribe for cleanup (will be handled by destroyGridView → activeControl.destroy)
  void origRefresh; //NOSONAR
}

function attachUnscheduleDropTarget(el: HTMLElement, refresh: () => void): void {
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    el.style.outline = '2px dashed var(--sp-accent-focus, #3b82f6)';
    el.style.outlineOffset = '-2px';
  });
  el.addEventListener('dragleave', () => {
    el.style.outline = '';
    el.style.outlineOffset = '';
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.style.outline = '';
    el.style.outlineOffset = '';
    const raw = e.dataTransfer?.getData('application/json');
    if (!raw) return;
    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (payload?.type !== 'GRID_MATCHUP') return;
    const matchUp = payload.matchUp;
    if (!matchUp?.matchUpId) return;
    unscheduleFromCourt(matchUp.matchUpId, matchUp.drawId ?? '', refresh);
  });
}

function unscheduleFromCourt(matchUpId: string, drawId: string, refresh: () => void): void {
  // Inspect the live matchUp to decide whether to preserve the scheduled
  // time. With a time → keep it (stays on the Scheduled tab). Without a
  // time → clear the date too (drops onto the Unscheduled tab).
  const { matchUps } = getCachedAllMatchUps();
  const matchUp = (matchUps || []).find((m: any) => m.matchUpId === matchUpId);
  const hasTime = !!matchUp?.schedule?.scheduledTime;

  const schedule: Record<string, string> = {
    courtId: '',
    venueId: '',
    courtOrder: '',
  };
  if (!hasTime) {
    schedule.scheduledDate = '';
    schedule.scheduledTime = '';
  }

  executeMethods(
    [
      {
        method: ADD_MATCHUP_SCHEDULE_ITEMS,
        params: { matchUpId, drawId, schedule, removePriorValues: true },
      },
      // Explicit unschedule — clear any prior active-strip "called" stamp.
      {
        method: SET_MATCHUP_CALLED_AT,
        params: { matchUpId, drawId, calledAt: null },
      },
    ],
    refresh,
  );
}

// Convert an "HH:mm" schedule string to total minutes; missing/invalid times
// sort to the bottom of the Scheduled tab by returning +Infinity.
function scheduledTimeToMinutes(time: string | undefined): number {
  if (!time || typeof time !== 'string') return Number.POSITIVE_INFINITY;
  const parts = time.split(':');
  if (parts.length < 2) return Number.POSITIVE_INFINITY;
  const h = Number.parseInt(parts[0], 10);
  const m = Number.parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return Number.POSITIVE_INFINITY;
  return h * 60 + m;
}

export function destroyGridView(): void {
  if (activeStripUnsubscribe) {
    activeStripUnsubscribe();
    activeStripUnsubscribe = null;
  }
  if (catalogStateUnsubscribe) {
    catalogStateUnsubscribe();
    catalogStateUnsubscribe = null;
  }
  if (activeStripBlockTicker) {
    clearInterval(activeStripBlockTicker);
    activeStripBlockTicker = null;
  }
  activeStrip = null;
  latestStripSnapshot = null;
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

/** Number of unsaved bulk scheduling changes — for caller-side confirm copy. */
export function getUnsavedGridChangeCount(): number {
  return bulkMode ? pendingMethods.length : 0;
}

/**
 * Flip bulk mode on/off. Idempotent. When turning OFF with pending changes
 * the queue is discarded — the caller is responsible for any "are you sure"
 * confirmation prompt before invoking this (we never open a native browser
 * dialog from inside a pure state mutation). Returns the new state.
 */
export function setGridBulkMode(enabled: boolean): boolean {
  if (bulkMode === enabled) return bulkMode;
  if (!enabled && pendingMethods.length > 0) {
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
export function searchGridCells(text: string): void {
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
        if (!result.success) console.error('[schedule2] mutation error', result);
        // Factory state just changed — drop matchUp caches so the refresh
        // re-fetches against the new truth. dateRange/tournamentInfo are
        // page-scoped and survive mutations.
        invalidateMatchUpCaches();
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
    scheduleToast({ message: 'Schedule change failed locally', intent: 'is-danger' });
    return;
  }

  // Queue methods for batch server send
  pendingMethods.push(methods);
  // Bulk mode runs the mutation locally, so the cached matchUp data is
  // already stale relative to the engine — invalidate before the refresh
  // pulls fresh data.
  invalidateMatchUpCaches();
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
        scheduleToast({ message: `Saved ${allMethods.length} scheduling changes`, intent: 'is-success' });
      } else {
        console.error('[schedule2] bulk save error', result);
        scheduleToast({ message: 'Failed to save scheduling changes to server', intent: 'is-danger' });
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

  const tournamentId = getCachedTournamentInfo()?.tournamentInfo?.tournamentId;
  if (!tournamentId) return;

  try {
    const record = await tmx2db.findTournament(tournamentId);
    if (record) {
      competitionEngine.setState(record);
      // setState rewrote the engine's tournament store underneath the
      // cache — drop matchUp caches so the re-render reads fresh data.
      invalidateMatchUpCaches();
    }
  } catch (err) {
    console.error('[schedule2] failed to reload from IndexedDB', err);
  }

  pendingMethods = [];
  scheduleToast({ message: 'Scheduling changes discarded', intent: INTENT_WARNING });
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
    cell.style.cssText = 'min-height: 60px; font-size: 0.6875rem;';
    cell.setAttribute(DATA_COURT_ID, courtId);
    cell.setAttribute(DATA_VENUE_ID, venueId);
    cell.setAttribute(DATA_COURT_ORDER, String(courtOrder));

    const matchUpId = cellContent.getAttribute(DATA_MATCHUP_ID);
    const drawId = cellContent.getAttribute(DATA_DRAW_ID);
    if (matchUpId) cell.setAttribute(DATA_MATCHUP_ID, matchUpId);
    if (drawId) cell.setAttribute(DATA_DRAW_ID, drawId);
    // The occupant's own scheduledTime — read by the swap path so the two
    // matchUps trade times along with court/order (a true positional swap).
    if (matchUpId && cellData?.schedule?.scheduledTime) {
      cell.setAttribute(DATA_SCHEDULED_TIME, cellData.schedule.scheduledTime);
    }

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
        // The dragged matchUp's origin slot. When it's dropped onto an occupied
        // grid cell, the occupant is relocated here — a true swap. Without this
        // the displaced matchUp would have nowhere to go and fall off the grid.
        source: {
          courtId: cellData.schedule?.courtId,
          venueId: cellData.schedule?.venueId,
          courtOrder: cellData.schedule?.courtOrder,
          scheduledTime: cellData.schedule?.scheduledTime,
          scheduledDate: cellData.schedule?.scheduledDate,
        },
      }),
    );
    // Marker so the Now-strip dragover affordance can detect a grid-sourced
    // drag without reading the (drag-protected) payload mid-drag.
    e.dataTransfer!.setData(GRID_DRAG_MARKER, '1');
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
    'padding: 10px; min-width: 220px; max-width: 300px; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 0.75rem;';

  // quick actions
  const actions = document.createElement('div');
  actions.style.cssText = DISPLAY_FLEX + '; gap: 6px; margin-bottom: 8px;';

  const showAllBtn = document.createElement('button');
  showAllBtn.className = 'button font-medium';
  showAllBtn.style.cssText = 'font-size: 0.6875rem; padding: 2px 8px; border-radius: 4px; cursor: pointer;';
  showAllBtn.textContent = t('schedule.showAll');
  showAllBtn.addEventListener('click', () => {
    hiddenCourtIds.clear();
    destroyVisibilityTip();
    onChanged();
  });

  const hideEmptyBtn = document.createElement('button');
  hideEmptyBtn.className = 'button font-medium';
  hideEmptyBtn.style.cssText = 'font-size: 0.6875rem; padding: 2px 8px; border-radius: 4px; cursor: pointer;';
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
        'font-size: 0.5625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--sp-muted, #9ca3af); margin: 6px 0 2px;';
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
      badge.style.cssText = 'font-size: 0.625rem; color: var(--sp-muted, #9ca3af);';
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
  const {
    grid,
    stickyHeader,
    courtsData,
    courtCount,
    emptyCount,
    handleAddVenue,
    allCourtsData,
    matchUpCounts,
    onVisibilityChanged,
    scheduledDate,
  } = params;
  const corner = document.createElement('div');
  corner.style.cssText =
    stickyHeader +
    '; left: 0; z-index: 3; color: var(--sp-muted); cursor: pointer;' +
    DISPLAY_FLEX +
    '; align-items: center; justify-content: center; gap: 4px;';

  const eyeIcon = document.createElement('i');
  eyeIcon.className = hiddenCourtIds.size > 0 ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  eyeIcon.style.cssText = 'font-size: 0.75rem;';
  corner.appendChild(eyeIcon);

  if (hiddenCourtIds.size > 0) {
    const badge = document.createElement('span');
    badge.style.cssText =
      'font-size: 0.5625rem; font-weight: 700; background: var(--tmx-fill-accent, #2563eb); color: #fff; border-radius: 50%; min-width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center;';
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
        th.innerHTML = `<button style="font-size: 0.6875rem; font-weight: 600; padding: 3px 10px; border-radius: 6px; border: 1px solid var(--tmx-accent-blue, #3b82f6); background: var(--tmx-bg-primary, #fff); color: var(--tmx-accent-blue, #3b82f6); cursor: pointer;">${addVenueLabel}</button>`;
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
  const TIME_COL_WIDTH = GRID_TIME_COL_WIDTH_PX;
  const MIN_PLACEHOLDER_ROWS = 8;

  const root = document.createElement('div');
  root.style.cssText = 'width: 100%; height: 100%; overflow: auto;';
  gridRootElement = root;

  const handleAddVenue = () => {
    addVenue((result: any) => {
      if (result?.success) {
        // addVenue bypasses our executeMethods invalidation hook — the
        // new court column would never appear on refresh without an
        // explicit cache drop here (Journey 41 caught this).
        invalidateMatchUpCaches();
        // Refresh in place via the grid's own rebuild path (matches every
        // other mutation in this file). The heavyweight renderSchedule2Tab
        // tore down the entire tab and short-circuited back to a router
        // navigate when currentDate happened to be empty, so the new
        // venue's column would silently fail to appear.
        callbacks.onRefresh();
      }
    }, COMPETITION_ENGINE);
  };

  function render(date: string): void {
    root.innerHTML = '';

    // Tournament-level minCourtGridRows extension wins over the hardcoded
    // default so all directors editing the tournament see the same grid
    // density once anyone has nudged the Rows stepper in the header.
    const extensionMinRows = readScheduleDisplayConfig().minCourtGridRows;
    const minCourtGridRows = extensionMinRows ?? DEFAULT_MIN_COURT_GRID_ROWS;
    const MIN_COURT_WIDTH = readUserMinCourtWidth();
    const scheduleResult = getCachedScheduleMatchUps(date, { minCourtGridRows });

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
      activeStrip?.setData(buildActiveStripData(date));
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

      buildRowCourtCells({
        grid,
        row,
        ri,
        visibleCourts,
        courtPrefix,
        emptyCellStyle: EMPTY_CELL,
        allRows: rows,
        callbacks,
      });

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

/**
 * Build a courtId → ActiveStripCourtBlock map describing which availability
 * blocks are active on each court right now. Used by the live strip to
 * surface PRACTICE / MAINTENANCE / RESERVED time windows that aren't
 * matchUps. Excludes SCHEDULED blocks since those are already shown as
 * cells in the grid.
 */
function buildCurrentCourtBlocks(date: string): Record<string, ActiveStripCourtBlock> {
  const { tournamentRecord } = tournamentEngine.getTournament() || {};
  if (!tournamentRecord) return {};

  let engine: any;
  try {
    engine = new AvailabilityEngine();
    engine.init(tournamentRecord);
  } catch {
    return {};
  }

  let blocks: any[];
  try {
    blocks = engine.getDayBlocks(date) || [];
  } catch {
    return {};
  }
  if (!blocks.length) return {};

  // Use the strip's date as the time anchor so painted blocks on a non-today
  // date (e.g. tournament startDate) still surface as active when the
  // operator is working at the matching time-of-day.
  const now = effectiveNowOnStripDate(date);
  const courtBlocks: Record<string, ActiveStripCourtBlock> = {};
  const activeRegsByCourtId = getActiveRegistrationNamesByCourtId({
    tournamentRecord,
    date,
    currentHM: formatHM(now),
  });

  for (const block of blocks) {
    if (block?.type === 'SCHEDULED') continue;
    if (!block.start || !block.end || !block.court?.courtId) continue;

    const start = new Date(block.start);
    const end = new Date(block.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    if (now < start || now >= end) continue;

    const courtId = block.court.courtId;
    if (courtBlocks[courtId]) continue;

    const registrantNames = block.type === 'PRACTICE' ? activeRegsByCourtId[courtId] : undefined;
    const detail = registrantNames?.length ? registrantNames.join(', ') : block.reason || undefined;

    courtBlocks[courtId] = {
      type: block.type,
      label: `${block.type} ${formatHM(start)}–${formatHM(end)}`,
      detail,
    };
  }

  return courtBlocks;
}

function formatHM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Translate the factory schedule snapshot into the active-strip pure-logic shape. */
function buildActiveStripData(date: string): ActiveStripPanelData {
  const extensionMinRows = readScheduleDisplayConfig().minCourtGridRows;
  const result = getCachedScheduleMatchUps(date, {
    minCourtGridRows: extensionMinRows ?? DEFAULT_MIN_COURT_GRID_ROWS,
  });

  const rows: any[] = result.rows ?? [];
  const allCourtsData: any[] = result.courtsData ?? [];
  const courtPrefix: string = result.courtPrefix ?? 'C|';

  // Cache the full snapshot so the strip's delegated click handler can resolve
  // cellData via courtId + rowIndex without re-querying the engine.
  latestStripSnapshot = { rows, courtPrefix, courtsData: allCourtsData };

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
  const minCourtWidthPx = readUserMinCourtWidth();
  const gridTemplateColumns = `${GRID_TIME_COL_WIDTH_PX}px repeat(${totalColumns}, minmax(${minCourtWidthPx}px, 1fr))`;
  const minWidth = `${GRID_TIME_COL_WIDTH_PX + totalColumns * minCourtWidthPx}px`;

  const courtBlocks = buildCurrentCourtBlocks(date);

  return { grid: { columns }, courts, courtBlocks, gridTemplateColumns, minWidth };
}

/**
 * Click handler for active-strip cells — opens the same popover as grid cells.
 * Resolves cellData from the cached schedule snapshot via courtId + rowIndex.
 */
function handleStripCellClick(event: MouseEvent, cellRoot: HTMLElement, refresh: () => void): void {
  if (!latestStripSnapshot) return;

  const courtId = cellRoot.getAttribute('data-court-id') ?? '';
  if (!courtId) return;

  const rowAttr = cellRoot.getAttribute('data-row-index');
  const rowIndex = rowAttr === null ? 0 : Number(rowAttr);

  const courtIndex = latestStripSnapshot.courtsData.findIndex((c) => c.courtId === courtId);
  if (courtIndex < 0) return;

  const court = latestStripSnapshot.courtsData[courtIndex];
  const cellKey = `${latestStripSnapshot.courtPrefix}${courtIndex}`;
  const cellData = latestStripSnapshot.rows[rowIndex]?.[cellKey];
  const courtOrder = cellData?.schedule?.courtOrder ?? rowIndex + 1;

  handleSchedule2CellClick(event, {
    cellData,
    courtId,
    venueId: court?.venueId ?? '',
    courtOrder,
    scheduledDate: currentDate,
    allRows: latestStripSnapshot.rows,
    courtPrefix: latestStripSnapshot.courtPrefix,
    rowIndex,
    onRefresh: refresh,
    executeMethods,
    matchUpListProvider: () => getFilteredMatchUpList(currentDate, activeControl),
    findCatalogItem: (mid: string) => buildCatalog(currentDate).find((m) => m.matchUpId === mid),
  });
}

/** Drop handler for the active strip — uses the resolved (courtId, rowIndex). */
/**
 * Pre-drop affordance for the Now strip. While a GRID matchUp is dragged over a
 * court whose Now slot is already occupied, show the OS "not-allowed" cursor
 * (dropEffect = 'none') and a danger outline, and suppress the component's
 * valid-target highlight — so the rejection enforced by handleActiveStripDrop
 * is visible before the drop. Catalog drags and free cells are unaffected.
 *
 * Delegated on the strip root (not per-cell) so it survives the strip's
 * re-renders, which rebuild the cell DOM on every setData.
 */
function attachStripDropAffordance(stripEl: HTMLElement): void {
  const findCell = (node: EventTarget | null): HTMLElement | null => {
    let el = node as HTMLElement | null;
    while (el && el !== stripEl && !el.classList?.contains(STRIP_CELL_CLASS)) {
      el = el.parentElement;
    }
    return el?.classList?.contains(STRIP_CELL_CLASS) ? el : null;
  };
  const clearBlocked = (cell: HTMLElement): void => {
    cell.classList.remove(STRIP_DROP_BLOCKED_CLASS);
    cell.style.outline = '';
    cell.style.outlineOffset = '';
  };

  stripEl.addEventListener('dragover', (e) => {
    const cell = findCell(e.target);
    if (!cell) return;
    const isGridDrag = !!e.dataTransfer?.types?.includes(GRID_DRAG_MARKER);
    const occupied = !cell.classList.contains(STRIP_FREE_CLASS);
    if (isGridDrag && occupied) {
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
      cell.classList.remove(DROP_OVER_CLASS); // kill the component's valid-target highlight
      cell.classList.add(STRIP_DROP_BLOCKED_CLASS);
      cell.style.outline = '2px solid var(--sp-danger, #ef4444)';
      cell.style.outlineOffset = '-2px';
    } else {
      clearBlocked(cell);
    }
  });
  stripEl.addEventListener('dragleave', (e) => {
    const cell = findCell(e.target);
    if (cell) clearBlocked(cell);
  });
  stripEl.addEventListener('drop', (e) => {
    const cell = findCell(e.target);
    if (cell) clearBlocked(cell);
  });
}

function handleActiveStripDrop(
  payload: { type: 'CATALOG_MATCHUP' | 'GRID_MATCHUP'; matchUp: any },
  target: { courtId: string; rowIndex: number },
  refresh: () => void,
  event?: DragEvent,
): void {
  // A matchUp dragged FROM the grid may only land on an EMPTY Now-strip cell.
  // If the court's Now slot already shows a live/next matchUp, reject the drop —
  // the strip is what's imminent and shouldn't be displaced by a grid drag.
  // Catalog drags are unaffected; re-dropping the same matchUp is a no-op.
  if (payload.type === 'GRID_MATCHUP' && event) {
    let cellEl = event.target as HTMLElement | null;
    while (cellEl && !cellEl.classList?.contains(STRIP_CELL_CLASS)) {
      cellEl = cellEl.parentElement;
    }
    if (cellEl) {
      const reject = shouldRejectStripDrop({
        payloadType: payload.type,
        draggedMatchUpId: payload.matchUp.matchUpId,
        cellOccupied: !cellEl.classList.contains(STRIP_FREE_CLASS),
        occupantMatchUpId: cellEl.querySelector(`[${DATA_MATCHUP_ID}]`)?.getAttribute(DATA_MATCHUP_ID),
      });
      if (reject) {
        scheduleToast({ message: "That court's Now slot is occupied", intent: INTENT_WARNING });
        return;
      }
    }
  }

  const extensionMinRows = readScheduleDisplayConfig().minCourtGridRows;
  const result = getCachedScheduleMatchUps(currentDate, {
    minCourtGridRows: extensionMinRows ?? DEFAULT_MIN_COURT_GRID_ROWS,
  });
  const courtsData: any[] = result.courtsData ?? [];
  const court = courtsData.find((c) => c.courtId === target.courtId);
  if (!court) return;

  // Row #2.7 — when an availability block on this court would either be
  // active right now OR start before the matchUp's average duration
  // completes, surface a confirm modal so the TD makes the call
  // deliberately. Skip when no block info or no format timing is
  // available; the original drop behavior stands in those cases.
  const blockCheck = checkBlockInterruption(payload.matchUp, target.courtId);
  if (blockCheck) {
    const title =
      blockCheck.kind === 'active'
        ? `Court currently has ${blockCheck.blockType}`
        : 'Court will be unavailable before this matchUp completes';
    const query =
      blockCheck.kind === 'active'
        ? `${blockCheck.blockType} runs until ${blockCheck.edgeLabel} on this court — only ${blockCheck.availableMinutes} min until the court is free. Expected play time is ~${blockCheck.averageMinutes} min. Schedule anyway?`
        : `${blockCheck.blockType} starts at ${blockCheck.edgeLabel} on this court. Expected play time is ~${blockCheck.averageMinutes} min, leaving only ${blockCheck.availableMinutes} min before the block. Schedule anyway?`;
    confirmModal({
      title,
      query,
      okIntent: INTENT_WARNING,
      okAction: () => commitActiveStripDrop(payload, target, court, refresh),
    });
    return;
  }

  commitActiveStripDrop(payload, target, court, refresh);
}

function commitActiveStripDrop(
  payload: { type: 'CATALOG_MATCHUP' | 'GRID_MATCHUP'; matchUp: any },
  target: { courtId: string; rowIndex: number },
  court: any,
  refresh: () => void,
): void {
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

  // Stamp the "called to court" timestamp — the active-strip drop is the
  // deliberate signal that this matchUp is imminent. Distinct from regular
  // grid drops (which leave calledAt untouched as historical record).
  methods.push({
    method: SET_MATCHUP_CALLED_AT,
    params: {
      matchUpId: payload.matchUp.matchUpId,
      drawId: payload.matchUp.drawId ?? '',
      calledAt: new Date().toISOString(),
    },
  });

  executeMethods(methods, refresh);
}

/**
 * Project today's real-time HH:MM onto the strip's date. Lets the live-strip
 * warnings work when the user is viewing a non-today date (e.g. tournament
 * startDate from yesterday) so painted blocks still surface as active /
 * upcoming relative to the time-of-day the operator is working at.
 *
 * When the strip date IS today, returns the real clock as-is.
 */
function effectiveNowOnStripDate(stripDate: string): Date {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (today === stripDate) return now;
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return new Date(`${stripDate}T${hh}:${mm}:${ss}`);
}

/**
 * Resolve the effective matchUpFormat for a matchUp. The catalog payload
 * often lacks a matchUpFormat (inherited from the drawDefinition); fall back
 * to that draw's format so downstream timing lookups work.
 */
function resolveMatchUpFormat(matchUp: any): string | undefined {
  if (matchUp?.matchUpFormat) return matchUp.matchUpFormat;
  const drawId = matchUp?.drawId;
  if (!drawId) return undefined;
  const { tournamentRecord } = tournamentEngine.getTournament() || {};
  if (!tournamentRecord) return undefined;
  for (const event of tournamentRecord.events || []) {
    for (const draw of event.drawDefinitions || []) {
      if (draw.drawId === drawId) return draw.matchUpFormat;
    }
  }
  return undefined;
}

interface BlockInterruptionWarning {
  /** 'active' when the block is in effect right now; 'upcoming' when it starts later. */
  kind: 'active' | 'upcoming';
  blockType: string;
  /** For 'upcoming': start time. For 'active': end time. */
  edgeLabel: string;
  averageMinutes: number;
  /** Minutes between "now" and the block edge that matters (start for upcoming, end for active). */
  availableMinutes: number;
}

/**
 * Returns warning details when scheduling the given matchUp on a court at
 * "now" would conflict with an availability block — either an active block
 * the matchUp would overlap, or an upcoming block that would interrupt the
 * matchUp before its average duration completes. Returns undefined when no
 * conflict — caller proceeds directly to the drop commit.
 */
function checkBlockInterruption(matchUp: any, courtId: string): BlockInterruptionWarning | undefined {
  const { tournamentRecord } = tournamentEngine.getTournament() || {};
  if (!tournamentRecord) return undefined;

  const matchUpFormat = resolveMatchUpFormat(matchUp);
  if (!matchUpFormat) return undefined;

  // Average minutes for this matchUp format under the active scheduling timing.
  let timing: any;
  try {
    timing = competitionEngine.getMatchUpFormatTiming?.({
      matchUpFormat,
      eventType: matchUp.matchUpType,
    });
  } catch {
    return undefined;
  }
  const averageMinutes = Number(timing?.averageMinutes);
  if (!averageMinutes || !Number.isFinite(averageMinutes) || averageMinutes <= 0) return undefined;

  let engine: any;
  try {
    engine = new AvailabilityEngine();
    engine.init(tournamentRecord);
  } catch {
    return undefined;
  }

  let blocks: any[];
  try {
    blocks = engine.getDayBlocks(currentDate) || [];
  } catch {
    return undefined;
  }
  if (!blocks.length) return undefined;

  const now = effectiveNowOnStripDate(currentDate);

  // First: is a non-SCHEDULED block currently active on this court?
  for (const block of blocks) {
    if (block?.type === 'SCHEDULED') continue;
    if (!block.start || !block.end || block.court?.courtId !== courtId) continue;
    const start = new Date(block.start);
    const end = new Date(block.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    if (now >= start && now < end) {
      const minutesUntilEnd = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 60000));
      return {
        kind: 'active',
        blockType: String(block.type),
        edgeLabel: formatHM(end),
        averageMinutes,
        availableMinutes: minutesUntilEnd,
      };
    }
  }

  // Otherwise: does an upcoming block start before this matchUp could complete?
  let nextBlock: any | undefined;
  for (const block of blocks) {
    if (block?.type === 'SCHEDULED') continue;
    if (!block.start || block.court?.courtId !== courtId) continue;
    const start = new Date(block.start);
    if (Number.isNaN(start.getTime()) || start <= now) continue;
    if (!nextBlock || start < new Date(nextBlock.start)) nextBlock = block;
  }
  if (!nextBlock) return undefined;

  const availableMinutes = Math.floor((new Date(nextBlock.start).getTime() - now.getTime()) / 60000);
  if (availableMinutes >= averageMinutes) return undefined;

  return {
    kind: 'upcoming',
    blockType: String(nextBlock.type),
    edgeLabel: formatHM(new Date(nextBlock.start)),
    averageMinutes,
    availableMinutes: Math.max(availableMinutes, 0),
  };
}

/**
 * Map a raw matchUp (from competitionEngine.allTournamentMatchUps) into the
 * CatalogMatchUpItem shape expected by buildMatchUpCard. Used by the Scheduled
 * sidebar panel so it can render the same card component as the Unscheduled
 * catalog. `isScheduled` is forced to false so dragstart wires up — the
 * prominent-time option on buildMatchUpCard handles the visual differentiation.
 */
function scheduledMatchUpToCatalogItem(m: any): CatalogMatchUpItem {
  return {
    matchUpId: m.matchUpId,
    eventId: m.eventId ?? '',
    eventName: m.eventName ?? '',
    drawId: m.drawId ?? '',
    drawName: m.drawName,
    structureId: m.structureId ?? '',
    structureName: m.structureName,
    stage: m.stage,
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
    isScheduled: false,
    scheduledTime: m.schedule?.scheduledTime,
    scheduledCourtName: m.schedule?.courtName,
  };
}

function buildCatalog(selectedDate: string): CatalogMatchUpItem[] {
  const { matchUps } = getCachedAllMatchUps();

  return (matchUps || [])
    .filter((m: any) => {
      if (m.matchUpStatus === BYE) return false;
      // A matchUp that is already scheduled on a DIFFERENT date does not belong
      // in this date's catalog — its time/court chips reference that other
      // day, and lumping it into "Unscheduled" here is misleading. To move it
      // to the current date the operator navigates to its date and reassigns.
      const scheduledDate = m.schedule?.scheduledDate;
      if (scheduledDate && scheduledDate !== selectedDate) return false;
      return true;
    })
    .map((m: any) => {
      // After the filter above, any `scheduledDate` we see is the selected
      // date, so onSelectedDate is implicit — collapse the previous two-flag
      // logic into a single isScheduled check.
      const hasDate = !!m.schedule?.scheduledDate;
      const hasCourtAssignment = !!(m.schedule?.courtId && hasDate);
      const hasTimeAssignment = !!(m.schedule?.scheduledTime && hasDate);
      const isScheduled = hasCourtAssignment || hasTimeAssignment || hasDate;

      return {
        matchUpId: m.matchUpId,
        eventId: m.eventId ?? '',
        eventName: m.eventName ?? '',
        drawId: m.drawId ?? '',
        drawName: m.drawName,
        structureId: m.structureId ?? '',
        structureName: m.structureName,
        stage: m.stage,
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
        isScheduled,
        scheduledTime: isScheduled ? m.schedule?.scheduledTime : undefined,
        scheduledCourtName: isScheduled ? m.schedule?.courtName : undefined,
      } satisfies CatalogMatchUpItem;
    });
}

export function buildScheduleDates(selectedDate: string): ScheduleDate[] {
  const { startDate, endDate } = getCachedCompetitionDateRange();
  const { tournamentInfo } = getCachedTournamentInfo();
  const activeDates = tournamentInfo?.activeDates;
  const dates = activeDates?.length ? [...activeDates].sort() : dateRange(startDate ?? '', endDate ?? '');

  const { matchUps } = getCachedAllMatchUps();
  const dateCounts = new Map<string, number>();
  for (const m of matchUps || []) {
    if (m.matchUpStatus === BYE) continue;
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
  const { matchUps } = getCachedAllMatchUps();
  const scheduledMatchUps = (matchUps || []).filter((m: any) => {
    return m.schedule?.courtId && m.schedule?.scheduledDate === selectedDate;
  });
  if (!scheduledMatchUps.length) return;

  const result = unwrapOr(competitionEngine.proConflicts({ matchUps: scheduledMatchUps }), null);
  if (!result) return;

  const conflicts = { courtIssues: result.courtIssues || {}, rowIssues: result.rowIssues || {} };

  const { SCHEDULE_ERROR, SCHEDULE_CONFLICT, SCHEDULE_WARNING } = scheduleConstants;

  // Issues from proConflicts are pushed in event-iteration order, not severity order.
  // Pick the highest severity so a red error always wins over a yellow warning.
  const severityRank = (issue: string): number => {
    if (issue === SCHEDULE_ERROR || issue === SCHEDULE_CONFLICT) return 2;
    if (issue === SCHEDULE_WARNING) return 1;
    return 0;
  };
  const topSeverity = (issues: any[]): string =>
    issues.reduce((top, cur) => (severityRank(cur.issue) > severityRank(top.issue) ? cur : top)).issue;

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
    const topIssue = topSeverity(issues);
    courtHeaders[ci].style.borderBottom = `3px solid ${severityColor(topIssue)}`;
    courtHeaders[ci].style.background = severityBgOpaque(topIssue);
  }

  // Row labels: rowIssues keyed by row index
  const rowIssueEntries = conflicts.rowIssues || {};
  for (const [rowIdx, issues] of Object.entries(rowIssueEntries)) {
    const ri = Number.parseInt(rowIdx);
    if (Number.isNaN(ri) || ri >= rowLabels.length || !(issues as any[])?.length) continue;
    const topIssue = topSeverity(issues as any[]);
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

  const { courtIssues, rowIssues } = unwrapOr(competitionEngine.proConflicts({ matchUps: allCellData }), {
    courtIssues: {},
    rowIssues: {},
  });

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
  const { matchUps } = getCachedAllMatchUps();
  const scheduledMatchUps = (matchUps || []).filter((m: any) => {
    return m.schedule?.courtId && m.schedule?.scheduledDate === selectedDate;
  });
  if (!scheduledMatchUps.length) return [];

  const conflictResult = unwrapOr(competitionEngine.proConflicts({ matchUps: scheduledMatchUps }), null);
  if (!conflictResult) return [];
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

  // TMX-only court time/order check. With "time travels with the matchUp", a
  // drag can leave a court's times out of order (a later courtOrder at an
  // equal/earlier time). proConflicts only flags same-court/same-ORDER double
  // booking and ignores scheduledTime, so we surface inversions here as a soft
  // WARN. Engine-side coverage is tracked in Mentat/TASKS.md.
  for (const tio of detectCourtTimeOrderIssues(scheduledMatchUps)) {
    const key = dedupKey(tio.matchUpId, [tio.earlierMatchUpId]);
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    const participants = matchUpLabel(tio.matchUpId);
    const earlier = matchUpLabel(tio.earlierMatchUpId);
    issues.push({
      severity: 'WARN',
      issueType: CONFLICT_COURT_TIME_ORDER,
      message: `Times out of order on court: ${participants} (${tio.scheduledTime}) is ordered after ${earlier} (${tio.earlierScheduledTime})`,
      participants,
      conflictParticipants: [earlier],
      conflictMatchUpIds: [tio.matchUpId, tio.earlierMatchUpId],
      matchUpId: tio.matchUpId,
      date: selectedDate,
    });
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
