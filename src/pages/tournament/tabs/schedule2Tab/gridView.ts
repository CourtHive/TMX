/**
 * Schedule 2 — Grid View
 *
 * Wires the courthive-components Schedule Page into TMX using real factory data.
 * Builds a court grid from competitionScheduleMatchUps and passes it as the
 * courtGridElement to createSchedulePage. Handles drop/remove callbacks via
 * mutationRequest (immediate mode).
 *
 * Drag-drop flow:
 *  - Catalog → Grid: card dragstart sets CATALOG_MATCHUP payload; grid cell drop fires onMatchUpDrop
 *  - Grid → Grid: filled cell dragstart sets GRID_MATCHUP payload; target cell drop fires onMatchUpDrop
 *  - Grid → Catalog: filled cell dragged onto catalog drop zone fires onMatchUpRemove
 *  - After each mutation the grid, catalog, and dates are rebuilt from factory state.
 */
import {
  createSchedulePage,
  buildScheduleGridCell,
  mapMatchUpToCellData,
  DEFAULT_SCHEDULE_CELL_CONFIG,
} from 'courthive-components';
import type { SchedulePageConfig, SchedulePageControl, CatalogMatchUpItem, ScheduleDate } from 'courthive-components';
import type { ScheduleIssue, ScheduleIssueSeverity } from 'courthive-components';
import { competitionEngine, matchUpStatusConstants, factoryConstants } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { COMPETITION_ENGINE } from 'constants/tmxConstants';
import { ADD_MATCHUP_SCHEDULE_ITEMS } from 'constants/mutationConstants';

const { scheduleConstants } = factoryConstants;

const { BYE } = matchUpStatusConstants;

let activeControl: SchedulePageControl | null = null;
let currentDate = '';

export function renderGridView(container: HTMLElement, scheduledDate: string): void {
  currentDate = scheduledDate;

  const catalog = buildCatalog(scheduledDate);
  const scheduleDates = buildScheduleDates(scheduledDate);
  const grid = buildInteractiveGrid(scheduledDate);
  const issues = buildIssues(scheduledDate);

  const config: SchedulePageConfig = {
    matchUpCatalog: catalog,
    scheduleDates,
    issues,
    courtGridElement: grid.element,
    gridMaxHeight: '70vh',
    scheduledBehavior: 'dim',
    schedulingMode: 'immediate',

    onMatchUpDrop: (payload, event) => {
      // Walk up from event.target to find the grid cell with data attributes
      let target = event.target as HTMLElement | null;
      while (target && !target.getAttribute('data-court-id')) {
        target = target.parentElement;
      }

      const courtId = target?.getAttribute('data-court-id');
      const venueId = target?.getAttribute('data-venue-id');
      const courtOrder = target?.getAttribute('data-court-order');

      if (!courtId || !venueId || !courtOrder) return;

      const methods: any[] = [];

      // If the target cell already has a matchUp, unschedule it first (swap)
      const existingMatchUpId = target?.getAttribute('data-matchup-id');
      const existingDrawId = target?.getAttribute('data-draw-id');
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

      mutationRequest({
        methods,
        engine: COMPETITION_ENGINE,
        callback: (result: any) => {
          if (!result.success) console.log('[schedule2] drop error', result);
          refresh();
        },
      });
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

      mutationRequest({
        methods,
        engine: COMPETITION_ENGINE,
        callback: (result: any) => {
          if (!result.success) console.log('[schedule2] remove error', result);
          refresh();
        },
      });
    },

    onMatchUpSelected: (m) => {
      // Could open inspector / popover in the future
      if (m) console.log('[schedule2] selected', m.matchUpId);
    },
  };

  activeControl = createSchedulePage(config, container);

  // Refresh helper — rebuilds everything from factory state after mutations
  function refresh(): void {
    if (!activeControl) return;
    grid.rebuild(currentDate);
    activeControl.setMatchUpCatalog(buildCatalog(currentDate));
    activeControl.setScheduleDates(buildScheduleDates(currentDate));
    activeControl.setIssues(buildIssues(currentDate));
  }
}

export function destroyGridView(): void {
  if (activeControl) {
    activeControl.destroy();
    activeControl = null;
  }
}

// ============================================================================
// Interactive Court Grid (with drag/drop + data attributes)
// ============================================================================

interface InteractiveGrid {
  element: HTMLElement;
  rebuild: (date: string) => void;
}

function buildInteractiveGrid(selectedDate: string): InteractiveGrid {
  const MIN_COURT_WIDTH = 110;
  const TIME_COL_WIDTH = 50;

  const root = document.createElement('div');
  root.style.cssText = 'width: 100%; overflow: auto;';

  function render(date: string): void {
    root.innerHTML = '';

    const scheduleResult = competitionEngine.competitionScheduleMatchUps({
      matchUpFilters: { scheduledDate: date },
      courtCompletedMatchUps: true,
      withCourtGridRows: true,
      minCourtGridRows: 14,
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
      'position: sticky', 'top: 0', 'z-index: 2',
      'background: var(--sp-panel-bg, #fff)', 'padding: 6px 4px',
      'font-size: 10px', 'font-weight: 700', 'text-align: center',
      'white-space: nowrap', 'overflow: hidden', 'text-overflow: ellipsis',
    ].join('; ');

    const STICKY_ROW = [
      'position: sticky', 'left: 0', 'z-index: 1',
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
        cell.setAttribute('data-court-id', courtId);
        cell.setAttribute('data-venue-id', venueId);
        cell.setAttribute('data-court-order', String(courtOrder));

        // Transfer matchUp/draw IDs from rendered cell
        const matchUpId = cellContent.getAttribute('data-matchup-id');
        const drawId = cellContent.getAttribute('data-draw-id');
        if (matchUpId) cell.setAttribute('data-matchup-id', matchUpId);
        if (drawId) cell.setAttribute('data-draw-id', drawId);

        cell.appendChild(cellContent);

        // ── Filled cells are draggable ──
        if (cellData?.matchUpId) {
          cell.draggable = true;
          cell.style.cursor = 'grab';
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
