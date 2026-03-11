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
import {
  createSchedulePage,
  buildScheduleGridCell,
  mapMatchUpToCellData,
  DEFAULT_SCHEDULE_CELL_CONFIG,
} from 'courthive-components';
import type { SchedulePageConfig, SchedulePageControl, CatalogMatchUpItem, ScheduleDate } from 'courthive-components';
import type { ScheduleIssue, ScheduleIssueSeverity } from 'courthive-components';
import { competitionEngine, matchUpStatusConstants, factoryConstants, tools } from 'tods-competition-factory';
import { handleSchedule2CellClick } from './schedule2CellActions';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tmxToast } from 'services/notifications/tmxToast';
import { scheduleConfig } from 'config/scheduleConfig';
import { tmx2db } from 'services/storage/tmx2db';
import { COMPETITION_ENGINE } from 'constants/tmxConstants';
import { ADD_MATCHUP_SCHEDULE_ITEMS } from 'constants/mutationConstants';

const { scheduleConstants } = factoryConstants;

const { BYE } = matchUpStatusConstants;

const DATA_COURT_ID = 'data-court-id';
const DATA_VENUE_ID = 'data-venue-id';
const DATA_COURT_ORDER = 'data-court-order';
const DATA_MATCHUP_ID = 'data-matchup-id';
const DATA_DRAW_ID = 'data-draw-id';
const POSITION_STICKY = 'position: sticky';

let activeControl: SchedulePageControl | null = null;
let currentDate = '';
let bulkMode = false;
let pendingMethods: any[][] = []; // Each entry is a methods array from one drop/remove
let actionBar: HTMLElement | null = null;
let actionBarContainer: HTMLElement | null = null;
let gridRootElement: HTMLElement | null = null;

export function renderGridView(container: HTMLElement, scheduledDate: string): void {
  currentDate = scheduledDate;
  actionBarContainer = container;

  // Late-binding refresh: grid cells reference this via closure, but grid is built
  // before activeControl exists. The wrapper defers to the real refresh once ready.
  function refresh(): void {
    if (!activeControl || !grid) return;
    grid.rebuild(currentDate);
    activeControl.setMatchUpCatalog(buildCatalog(currentDate));
    activeControl.setScheduleDates(buildScheduleDates(currentDate));
    activeControl.setIssues(buildIssues(currentDate));
  }

  const gridCallbacks: GridCallbacks = { onRefresh: refresh, executeMethods };

  const catalog = buildCatalog(scheduledDate);
  const scheduleDates = buildScheduleDates(scheduledDate);
  const grid = buildInteractiveGrid(scheduledDate, gridCallbacks);
  const issues = buildIssues(scheduledDate);

  const config: SchedulePageConfig = {
    matchUpCatalog: catalog,
    scheduleDates,
    issues,
    courtGridElement: grid.element,
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
            courtId,
            venueId,
            courtOrder: parseInt(courtOrder, 10),
            scheduledDate: currentDate,
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
}

export function destroyGridView(): void {
  if (activeControl) {
    activeControl.destroy();
    activeControl = null;
  }
  removeActionBar();
  pendingMethods = [];
  actionBarContainer = null;
  gridRootElement = null;
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
    const confirmed = window.confirm(
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
      if (!firstMatch) firstMatch = el;
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
      'display: flex',
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
  saveBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up" style="margin-right:6px;"></i>Save ${totalMethods} change${totalMethods !== 1 ? 's' : ''}`;
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
  status.textContent = `${count} unsaved action${count !== 1 ? 's' : ''} — changes are local only`;
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

function buildInteractiveGrid(selectedDate: string, callbacks: GridCallbacks): InteractiveGrid {
  const MIN_COURT_WIDTH = 110;
  const TIME_COL_WIDTH = 50;

  const root = document.createElement('div');
  root.style.cssText = 'width: 100%; overflow: auto;';
  gridRootElement = root;

  function render(date: string): void {
    root.innerHTML = '';

    const scheduleResult = competitionEngine.competitionScheduleMatchUps({
      matchUpFilters: { scheduledDate: date },
      courtCompletedMatchUps: true,
      withCourtGridRows: true,
      minCourtGridRows: scheduleConfig.get().minCourtGridRows,
    });

    const rows: any[] = scheduleResult.rows || [];
    const courtsData: any[] = scheduleResult.courtsData || [];
    const courtPrefix: string = scheduleResult.courtPrefix || 'C|';

    // Run proConflicts and annotate cell data with issue styling info
    annotateConflicts(rows, courtsData, courtPrefix);

    if (!courtsData.length) {
      root.textContent = 'No courts configured. Add venues and courts first.';
      root.style.cssText += 'padding: 24px; color: var(--tmx-muted); text-align: center;';
      return;
    }

    const courtCount = courtsData.length;

    const grid = document.createElement('div');
    grid.style.cssText = [
      'display: grid',
      'gap: 1px',
      'background: var(--sp-line, #e5e7eb)',
      `min-width: ${TIME_COL_WIDTH + courtCount * MIN_COURT_WIDTH}px`,
      `grid-template-columns: ${TIME_COL_WIDTH}px repeat(${courtCount}, minmax(${MIN_COURT_WIDTH}px, 1fr))`,
    ].join('; ');

    const STICKY_HEADER = [
      POSITION_STICKY, 'top: 0', 'z-index: 2',
      'background: var(--sp-panel-bg, #fff)', 'padding: 6px 4px',
      'font-size: 10px', 'font-weight: 700', 'text-align: center',
      'white-space: nowrap', 'overflow: hidden', 'text-overflow: ellipsis',
    ].join('; ');

    const STICKY_ROW = [
      POSITION_STICKY, 'left: 0', 'z-index: 1',
      'background: var(--sp-panel-bg, #fff)', 'padding: 6px 4px',
      'font-size: 10px', 'font-weight: 600', 'color: var(--sp-muted, #888)',
      'display: flex', 'align-items: center', 'justify-content: center',
    ].join('; ');

    // Corner
    const corner = document.createElement('div');
    corner.style.cssText = STICKY_HEADER + '; left: 0; z-index: 3; color: var(--sp-muted);';
    corner.textContent = 'Row';
    grid.appendChild(corner);

    // Court headers
    for (let ci = 0; ci < courtCount; ci++) {
      const court = courtsData[ci];
      const th = document.createElement('div');
      th.style.cssText = STICKY_HEADER;
      th.title = court.courtName || `Court ${ci + 1}`;
      th.textContent = court.courtName || `Court ${ci + 1}`;
      grid.appendChild(th);
    }

    // Data rows
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];

      const rowCell = document.createElement('div');
      rowCell.style.cssText = STICKY_ROW;
      rowCell.textContent = String(ri + 1);
      grid.appendChild(rowCell);

      for (let ci = 0; ci < courtCount; ci++) {
        const cellKey = `${courtPrefix}${ci}`;
        const cellData = row[cellKey];

        const courtInfo = courtsData[ci];
        const courtId = cellData?.schedule?.courtId ?? courtInfo?.courtId ?? '';
        const venueId = cellData?.schedule?.venueId ?? courtInfo?.venueId ?? '';
        const courtOrder = cellData?.schedule?.courtOrder ?? ri + 1;

        // Build the cell content using the configurable renderer
        const cellContent = buildScheduleGridCell(
          mapMatchUpToCellData(cellData || {}),
          DEFAULT_SCHEDULE_CELL_CONFIG,
        );

        // Wrap in a container that carries grid-level data attributes
        const cell = document.createElement('div');
        cell.style.cssText = 'min-height: 44px;';
        cell.setAttribute(DATA_COURT_ID, courtId);
        cell.setAttribute(DATA_VENUE_ID, venueId);
        cell.setAttribute(DATA_COURT_ORDER, String(courtOrder));

        // Transfer matchUp/draw IDs from rendered cell
        const matchUpId = cellContent.getAttribute(DATA_MATCHUP_ID);
        const drawId = cellContent.getAttribute(DATA_DRAW_ID);
        if (matchUpId) cell.setAttribute(DATA_MATCHUP_ID, matchUpId);
        if (drawId) cell.setAttribute(DATA_DRAW_ID, drawId);

        cell.appendChild(cellContent);

        // ── Filled cells are draggable ──
        if (cellData?.matchUpId) {
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
          cell.addEventListener('dragend', () => { cell.style.opacity = ''; });
        }

        // ── All cells are drop targets (unless blocked) ──
        if (!cellData?.isBlocked) {
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

        // ── Click handler for popover menu ──
        cell.addEventListener('click', (e: MouseEvent) => {
          // Ignore clicks that are part of a drag operation
          if (cell.draggable && cell.style.opacity === '0.4') return;

          handleSchedule2CellClick(e, {
            cellData,
            courtId,
            venueId,
            courtOrder,
            scheduledDate: currentDate,
            allRows: rows,
            courtPrefix,
            rowIndex: ri,
            onRefresh: callbacks.onRefresh,
            executeMethods: callbacks.executeMethods,
          });
        });
        cell.style.cursor = cell.draggable ? 'grab' : 'pointer';

        grid.appendChild(cell);
      }
    }

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

function buildCatalog(selectedDate: string): CatalogMatchUpItem[] {
  const { matchUps } = competitionEngine.allTournamentMatchUps({
    inContext: true,
    nextMatchUps: true,
  });

  return (matchUps || [])
    .filter((m: any) => m.matchUpStatus !== BYE)
    .map((m: any) => {
      const isScheduled = !!(m.schedule?.courtId && m.schedule?.scheduledDate);
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

function buildScheduleDates(selectedDate: string): ScheduleDate[] {
  const { startDate, endDate } = competitionEngine.getCompetitionDateRange();
  const dates = dateRange(startDate, endDate);

  const { matchUps } = competitionEngine.allTournamentMatchUps({ inContext: true });
  const dateCounts = new Map<string, number>();
  for (const m of matchUps || []) {
    const d = m.schedule?.scheduledDate;
    if (d) dateCounts.set(d, (dateCounts.get(d) || 0) + 1);
  }

  return dates.map((date) => ({
    date,
    isActive: date === selectedDate,
    matchUpCount: dateCounts.get(date) ?? 0,
  }));
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
    for (const issue of flatIssues as any[]) {
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

function buildIssues(selectedDate: string): ScheduleIssue[] {
  const { matchUps } = competitionEngine.allTournamentMatchUps({
    inContext: true,
    nextMatchUps: true,
  });

  // Filter to scheduled matchUps for the selected date
  const scheduledMatchUps = (matchUps || []).filter((m: any) => {
    if (!m.schedule?.courtId) return false;
    if (m.schedule?.scheduledDate !== selectedDate) return false;
    return true;
  });

  if (!scheduledMatchUps.length) return [];

  const conflictsResult = competitionEngine.proConflicts({ matchUps: scheduledMatchUps });
  if (conflictsResult.error) return [];

  const {
    SCHEDULE_ERROR,
    SCHEDULE_CONFLICT,
    SCHEDULE_WARNING,
    SCHEDULE_ISSUE,
  } = scheduleConstants;

  const mapSeverity = (issue: string): ScheduleIssueSeverity => {
    if (issue === SCHEDULE_ERROR) return 'ERROR';
    if (issue === SCHEDULE_CONFLICT) return 'ERROR';
    if (issue === SCHEDULE_WARNING) return 'WARN';
    if (issue === SCHEDULE_ISSUE) return 'INFO';
    return 'WARN';
  };

  const issues: ScheduleIssue[] = [];

  // Court issues
  for (const [, courtIssues] of Object.entries(conflictsResult.courtIssues || {})) {
    for (const ci of courtIssues as any[]) {
      issues.push({
        severity: mapSeverity(ci.issue),
        message: `${ci.issueType}: ${ci.matchUpId}${ci.issueIds?.length ? ' conflicts with ' + ci.issueIds.join(', ') : ''}`,
        matchUpId: ci.matchUpId,
        date: selectedDate,
      });
    }
  }

  // Row issues
  for (const [rowIdx, rowIssues] of Object.entries(conflictsResult.rowIssues || {})) {
    for (const ri of rowIssues as any[]) {
      issues.push({
        severity: mapSeverity(ri.issue),
        message: `Row ${parseInt(rowIdx) + 1}: ${ri.issueType}: ${ri.matchUpId}${ri.issueIds?.length ? ' conflicts with ' + ri.issueIds.join(', ') : ''}`,
        matchUpId: ri.matchUpId,
        date: selectedDate,
      });
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
