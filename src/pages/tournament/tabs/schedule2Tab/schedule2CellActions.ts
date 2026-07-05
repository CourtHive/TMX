/**
 * Schedule2 grid cell click actions.
 *
 * Provides sectioned popover menus for matchUp cells, empty cells, and blocked cells
 * in the schedule2 CSS grid. Uses tippy.js directly with custom DOM for a modern
 * pill/icon layout rather than the legacy flat menu list.
 */
import { activateScheduleCellTypeAhead, computeReschedulePlacements } from 'courthive-components';
import { matchUpStatusConstants, timeItemConstants, tools } from 'tods-competition-factory';
import { secondsToTimeString, timeStringToSeconds } from 'functions/timeStrings';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { getScheduleDateRange } from 'pages/tournament/tabs/scheduleUtils';
import { printMatchUpCourtCard } from 'components/modals/printCourtCards';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { closeModal, confirmModal, openModal } from 'components/modals/baseModal/baseModal';
import { destroyTipster } from 'components/popovers/tipster';
import { competitionEngine } from 'services/factory/engine';
import { timePicker } from 'components/modals/timePicker';
import { Datepicker } from 'vanillajs-datepicker';
import tippy, { type Instance } from 'tippy.js';
import { i18next, t } from 'i18n';

// constants
import {
  ADD_MATCHUP_SCHEDULE_ITEMS,
  BULK_SCHEDULE_MATCHUPS,
  SET_MATCHUP_CALLED_AT,
  SET_MATCHUP_STATUS,
} from 'constants/mutationConstants';
import { timeModifierText, RIGHT } from 'constants/tmxConstants';

const { AFTER_REST, FOLLOWED_BY, NEXT_AVAILABLE, NOT_BEFORE, TO_BE_ANNOUNCED } = timeItemConstants;
const { IN_PROGRESS, SUSPENDED } = matchUpStatusConstants;

const COLOR_ACCENT_BLUE = 'var(--tmx-accent-blue, #3b82f6)';
const COLOR_ACCENT_ORANGE = 'var(--tmx-accent-orange, #ef4444)';
const ICON_BAN = 'fa-ban';
const TINT_DANGER = 'rgba(244, 63, 94, 0.15)';

// MatchUp statuses that are terminal/decided — excluded from bulk time + status
// actions (a completed or walked-over match can't be started, suspended, etc.).
const TERMINAL_MATCHUP_STATUSES = new Set([
  'BYE',
  'WALKOVER',
  'DOUBLE_WALKOVER',
  'CANCELLED',
  'ABANDONED',
  'DOUBLE_DEFAULT',
  'DEFAULTED',
]);

// Singleton tippy instance for cell menus
let cellTip: Instance | undefined;

function destroyCellTip(): void {
  destroyTipster();
  if (cellTip) {
    cellTip.destroy();
    cellTip = undefined;
  }
}

// ── Types ──

export interface Schedule2CellContext {
  cellData: any;
  courtId: string;
  venueId: string;
  courtOrder: number;
  scheduledDate: string;
  allRows: any[];
  courtPrefix: string;
  rowIndex: number;
  onRefresh: () => void;
  executeMethods: (methods: any[], onRefresh: () => void) => void;
  matchUpListProvider?: () => Array<{ label: string; value: string }>;
  findCatalogItem?: (matchUpId: string) => any;
}

// ── Main dispatcher ──

export function handleSchedule2CellClick(e: MouseEvent, ctx: Schedule2CellContext): void {
  const { cellData } = ctx;

  if (cellData?.isBlocked) {
    showBlockedCellMenu(e, ctx);
    return;
  }

  if (!cellData?.matchUpId) {
    showEmptyCellMenu(e, ctx);
    return;
  }

  showMatchUpCellMenu(e, ctx);
}

// ============================================================================
// Shared DOM Helpers
// ============================================================================

const POPOVER_CSS = [
  'padding: 10px',
  'min-width: 200px',
  'max-width: 280px',
  'font-family: ui-sans-serif, system-ui, sans-serif',
  'font-size: 0.75rem',
].join('; ');

const SECTION_LABEL_CSS = [
  'font-size: 0.5625rem',
  'font-weight: 700',
  'text-transform: uppercase',
  'letter-spacing: 0.5px',
  'color: var(--sp-muted, var(--tmx-muted, #9ca3af))',
  'margin: 0 0 5px 0',
  'padding: 0',
].join('; ');

const PILL_ROW_CSS = 'display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px;';

// Pill background for default (non-colored) pills — semi-transparent so it works on any base
const PILL_BG = 'var(--sp-chip-bg, rgba(128,128,128,0.12))';

function makePill(
  label: string,
  onClick: () => void,
  opts?: { icon?: string; color?: string; outline?: boolean; tint?: string },
): HTMLElement {
  const btn = document.createElement('button');
  const bg = opts?.tint ? opts.tint : opts?.outline ? 'transparent' : opts?.color ? opts.color : PILL_BG;
  const border = opts?.outline
    ? `1px solid ${opts?.color ?? 'var(--sp-border, var(--tmx-border-primary))'}`
    : '1px solid transparent';
  const textColor = opts?.tint
    ? (opts?.color ?? 'inherit')
    : opts?.outline
      ? (opts?.color ?? 'inherit')
      : opts?.color
        ? '#fff'
        : 'inherit';
  btn.style.cssText = [
    `background: ${bg}`,
    `border: ${border}`,
    `color: ${textColor}`,
    'padding: 4px 10px',
    'border-radius: 14px',
    'font-size: 0.6875rem',
    'cursor: pointer',
    'white-space: nowrap',
    'display: inline-flex',
    'align-items: center',
    'gap: 5px',
    'transition: opacity 0.15s',
  ].join('; ');
  btn.addEventListener('mouseenter', () => {
    btn.style.opacity = '0.8';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.opacity = '';
  });
  if (opts?.icon) btn.innerHTML = `<i class="fa-solid ${opts.icon}" style="font-size: 0.625rem;"></i>${label}`;
  else btn.textContent = label;
  btn.addEventListener('click', () => {
    destroyCellTip();
    onClick();
  });
  return btn;
}

function makeIconBtn(title: string, icon: string, onClick: () => void, opts?: { color?: string }): HTMLElement {
  const btn = document.createElement('button');
  btn.style.cssText = [
    `background: ${PILL_BG}`,
    'border: 1px solid transparent',
    `color: ${opts?.color ?? 'inherit'}`,
    'width: 30px',
    'height: 30px',
    'border-radius: 8px',
    'font-size: 0.8125rem',
    'cursor: pointer',
    'display: inline-flex',
    'align-items: center',
    'justify-content: center',
    'transition: opacity 0.15s',
  ].join('; ');
  btn.title = title;
  btn.innerHTML = `<i class="fa-solid ${icon}"></i>`;
  btn.addEventListener('mouseenter', () => {
    btn.style.opacity = '0.8';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.opacity = '';
  });
  btn.addEventListener('click', () => {
    destroyCellTip();
    onClick();
  });
  return btn;
}

function makeSectionLabel(text: string): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = SECTION_LABEL_CSS;
  el.textContent = text;
  return el;
}

function makeTimeSectionLabel(): HTMLElement {
  return makeSectionLabel(t('schedule.time'));
}

function makeDivider(): HTMLElement {
  const hr = document.createElement('hr');
  hr.style.cssText = 'border: none; border-top: 1px solid var(--sp-border, var(--tmx-border-primary)); margin: 6px 0;';
  return hr;
}

function showPopover(target: HTMLElement, content: HTMLElement): void {
  // Toggle off when the same target is clicked twice in a row.
  const sameTarget = cellTip?.reference === target;
  destroyCellTip();
  if (sameTarget) return;
  cellTip = tippy(target, {
    content,
    theme: 'light-border',
    trigger: 'manual',
    interactive: true,
    placement: RIGHT,
    appendTo: () => document.body,
  });
  cellTip.show();
}

// ============================================================================
// MatchUp Cell Popover
// ============================================================================

function showMatchUpCellMenu(e: MouseEvent, ctx: Schedule2CellContext): void {
  const { cellData, allRows, courtPrefix, rowIndex, scheduledDate, onRefresh, executeMethods } = ctx;
  const matchUpId = cellData.matchUpId;

  const fullMatchUp = competitionEngine.allTournamentMatchUps({
    matchUpFilters: { matchUpIds: [matchUpId] },
    inContext: true,
    nextMatchUps: true,
  })?.matchUps?.[0];

  const matchUp = fullMatchUp || cellData;

  const setSchedule = (schedule: any) => {
    mutationRequest({
      methods: [
        { params: { matchUpIds: [matchUpId], schedule, removePriorValues: true }, method: BULK_SCHEDULE_MATCHUPS },
      ],
      callback: (result: any) => {
        if (result.success) onRefresh();
      },
    });
  };

  const timeSelected = ({ time }: { time: string }) => {
    const scheduledTime = tools.dateTime.convertTime(time, true) || '';
    setSchedule({ scheduledTime });
  };

  const setMatchUpTime = () => {
    const previousTimes: number[] = [];
    for (let ri = 0; ri < rowIndex; ri++) {
      const row = allRows[ri];
      if (!row) continue;
      for (const key of Object.keys(row)) {
        if (!key.startsWith(courtPrefix)) continue;
        const t = row[key]?.schedule?.scheduledTime;
        if (t) previousTimes.push(timeStringToSeconds(t));
      }
    }
    const maxSeconds = Math.max(...previousTimes, 0);
    const nextHour = rowIndex > 0;
    const time = (maxSeconds && secondsToTimeString(maxSeconds, nextHour)) || '8:00 AM';
    timePicker({ time, callback: timeSelected });
  };

  const modifyTime = (modifier: string) => setSchedule({ timeModifiers: [modifier] });
  const clearTimeSettings = () => setSchedule({ scheduledTime: '', timeModifiers: [] });

  const readyToScore = matchUp?.readyToScore || matchUp?.winningSide || matchUp?.score?.sets;

  const setStartTime = () => {
    timePicker({
      time: matchUp?.schedule?.startTime || '',
      callback: ({ time }) => {
        const startTime = tools.dateTime.convertTime(time, true) as string;
        if (startTime) setSchedule({ startTime });
      },
    });
  };

  const setEndTime = () => {
    timePicker({
      time: matchUp?.schedule?.endTime || '',
      callback: ({ time }) => {
        const endTime = tools.dateTime.convertTime(time, true) as string;
        if (endTime) setSchedule({ endTime });
      },
    });
  };

  const startMatch = () => {
    const drawId = matchUp?.drawId || cellData.drawId;
    if (!drawId) return;
    const now = new Date();
    const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    executeMethods(
      [
        {
          params: { matchUpIds: [matchUpId], schedule: { startTime }, removePriorValues: true },
          method: BULK_SCHEDULE_MATCHUPS,
        },
        { method: SET_MATCHUP_STATUS, params: { matchUpId, drawId, outcome: { matchUpStatus: IN_PROGRESS } } },
      ],
      onRefresh,
    );
  };

  const callToCourt = () => {
    const drawId = matchUp?.drawId || cellData.drawId;
    if (!drawId) return;
    executeMethods(
      [{ method: SET_MATCHUP_CALLED_AT, params: { matchUpId, drawId, calledAt: new Date().toISOString() } }],
      onRefresh,
    );
  };

  const noParticipants = !matchUp?.sides?.some((s: any) => s?.participantId || s?.participant?.participantId);
  const matchUpStatus = matchUp?.matchUpStatus || cellData?.matchUpStatus;
  const terminalStatuses = [
    'BYE',
    'WALKOVER',
    'DOUBLE_WALKOVER',
    'CANCELLED',
    'ABANDONED',
    'DOUBLE_DEFAULT',
    'DEFAULTED',
  ];
  const isTerminal = terminalStatuses.includes(matchUpStatus);
  const isInProgress = matchUpStatus === IN_PROGRESS;
  const isCalled = !!(matchUp?.schedule?.calledAt || cellData?.schedule?.calledAt);
  const hideTimeActions = noParticipants || isTerminal;
  const hideStartMatch = hideTimeActions || isInProgress || matchUp?.winningSide;
  // "Call to court" announces a match without starting it; hide once it's called,
  // live, or decided.
  const hideCallToCourt = hideTimeActions || isInProgress || isCalled || matchUp?.winningSide;

  const scoreMatchUp = () => enterMatchUpScore({ matchUp, matchUpId, callback: () => onRefresh() });

  const viewDraw = () => {
    const drawId = matchUp?.drawId || cellData.drawId;
    const eventId = matchUp?.eventId || cellData.eventId;
    const structureId = matchUp?.structureId || cellData.structureId;
    const focusMatchUpId = matchUp?.matchUpId || matchUpId || cellData.matchUpId;
    // Pass matchUpId (+ structureId) so navigateToEvent stashes a pending focus
    // and renderDrawView scrolls to and highlights the matchUp — mirroring the
    // matchUps-page event-chip navigation.
    if (drawId && eventId)
      navigateToEvent({ eventId, drawId, structureId, matchUpId: focusMatchUpId, renderDraw: true });
  };

  const removeFromSchedule = () => {
    const drawId = matchUp?.drawId || cellData.drawId || '';
    executeMethods(
      [
        {
          method: ADD_MATCHUP_SCHEDULE_ITEMS,
          params: {
            matchUpId,
            drawId,
            schedule: { scheduledTime: '', scheduledDate: '', courtOrder: '', venueId: '', courtId: '' },
            removePriorValues: true,
          },
        },
      ],
      onRefresh,
    );
  };

  const hasCourtId = matchUp?.schedule?.courtId || cellData?.schedule?.courtId;

  // ── Build popover DOM ──
  const pop = document.createElement('div');
  pop.style.cssText = POPOVER_CSS;

  // Section 1: Time
  pop.appendChild(makeTimeSectionLabel());
  const timeRow = document.createElement('div');
  timeRow.style.cssText = PILL_ROW_CSS;
  timeRow.appendChild(makePill(t('schedule.setTime'), setMatchUpTime, { icon: 'fa-clock' }));
  if (!hideCallToCourt)
    timeRow.appendChild(
      makePill(t('schedule.callToCourt'), callToCourt, {
        icon: 'fa-bullhorn',
        color: COLOR_ACCENT_ORANGE,
        outline: true,
      }),
    );
  if (!hideStartMatch)
    timeRow.appendChild(
      makePill(t('schedule.startMatch'), startMatch, {
        icon: 'fa-play',
        color: COLOR_ACCENT_BLUE,
        outline: true,
      }),
    );
  if (!hideTimeActions) {
    timeRow.appendChild(makePill(t('schedule.startTime'), setStartTime));
    timeRow.appendChild(makePill(t('schedule.endTime'), setEndTime));
  }
  pop.appendChild(timeRow);

  // Section 2: Schedule annotations
  pop.appendChild(makeSectionLabel(t('schedule.annotations')));
  const annoRow = document.createElement('div');
  annoRow.style.cssText = PILL_ROW_CSS;
  annoRow.appendChild(makePill(timeModifierText[FOLLOWED_BY], () => modifyTime(FOLLOWED_BY)));
  annoRow.appendChild(makePill(timeModifierText[NEXT_AVAILABLE], () => modifyTime(NEXT_AVAILABLE)));
  annoRow.appendChild(makePill(timeModifierText[NOT_BEFORE], () => modifyTime(NOT_BEFORE)));
  annoRow.appendChild(makePill(timeModifierText[AFTER_REST], () => modifyTime(AFTER_REST)));
  annoRow.appendChild(makePill(timeModifierText[TO_BE_ANNOUNCED], () => modifyTime(TO_BE_ANNOUNCED)));
  annoRow.appendChild(makePill(t('schedule.clearTimeSettings'), clearTimeSettings, { icon: 'fa-xmark' }));
  pop.appendChild(annoRow);

  const printCard = () => printMatchUpCourtCard({ matchUpId, scheduledDate });
  const sideHasParticipant = (s: any) => !!(s?.participantId || s?.participant?.participantId);
  const sides = matchUp?.sides || [];
  const bothSidesAssigned = sides.length >= 2 && sideHasParticipant(sides[0]) && sideHasParticipant(sides[1]);

  // Section 3: Actions (icon buttons)
  pop.appendChild(makeDivider());
  const actionsRow = document.createElement('div');
  actionsRow.style.cssText = 'display: flex; align-items: center; gap: 6px;';
  if (readyToScore)
    actionsRow.appendChild(
      makeIconBtn(t('schedule.enterScore'), 'fa-pen-to-square', scoreMatchUp, {
        color: COLOR_ACCENT_BLUE,
      }),
    );
  if (matchUp?.drawId || cellData.drawId)
    actionsRow.appendChild(makeIconBtn(t('schedule.viewDraw'), 'fa-sitemap', viewDraw));
  if (hasCourtId)
    actionsRow.appendChild(
      makeIconBtn(t('schedule.removeFromSchedule'), 'fa-calendar-xmark', removeFromSchedule, {
        color: COLOR_ACCENT_ORANGE,
      }),
    );
  const isFinished = !!matchUp?.winningSide || isTerminal;
  if (bothSidesAssigned && !isFinished && !isInProgress) {
    const printBtn = makeIconBtn('Print court card', 'fa-print', printCard);
    printBtn.style.marginLeft = 'auto';
    actionsRow.appendChild(printBtn);
  }
  if (actionsRow.children.length) pop.appendChild(actionsRow);

  // Walk up to the grid cell for accurate popover positioning
  let target = e.target as HTMLElement;
  while (target && !target.dataset.courtId) target = target.parentElement as HTMLElement;
  showPopover(target || (e.target as HTMLElement), pop);
}

// ============================================================================
// Empty Cell Popover
// ============================================================================

function showEmptyCellMenu(e: MouseEvent, ctx: Schedule2CellContext): void {
  const {
    courtId,
    venueId,
    courtOrder,
    scheduledDate,
    onRefresh,
    executeMethods,
    matchUpListProvider,
    findCatalogItem,
  } = ctx;
  if (!courtId || !courtOrder) return;

  const assignMatchUp = () => {
    if (!matchUpListProvider) return;
    let cell = e.target as HTMLElement;
    while (cell && !cell.dataset.courtId) cell = cell.parentElement as HTMLElement;
    if (!cell) return;
    activateScheduleCellTypeAhead({
      cell,
      listProvider: matchUpListProvider,
      onSelect: (matchUpId: string) => {
        const item = findCatalogItem?.(matchUpId);
        executeMethods(
          [
            {
              method: ADD_MATCHUP_SCHEDULE_ITEMS,
              params: {
                matchUpId,
                drawId: item?.drawId ?? '',
                schedule: { courtId, venueId, courtOrder, scheduledDate },
                removePriorValues: true,
              },
            },
          ],
          onRefresh,
        );
      },
    });
  };

  const blockCourt = (rowCount: number, bookingType: string = 'BLOCKED') => {
    mutationRequest({
      methods: [
        { method: 'addCourtGridBooking', params: { courtId, scheduledDate, courtOrder, rowCount, bookingType } },
      ],
      callback: (result: any) => {
        if (result.success) onRefresh();
      },
    });
  };

  const pop = document.createElement('div');
  pop.style.cssText = POPOVER_CSS;

  // Assign matchUp
  if (matchUpListProvider) {
    pop.appendChild(makeSectionLabel(t('schedule.assign')));
    const assignRow = document.createElement('div');
    assignRow.style.cssText = PILL_ROW_CSS;
    assignRow.appendChild(
      makePill(t('schedule.assignMatchUp'), assignMatchUp, {
        icon: 'fa-plus',
        tint: 'rgba(16, 185, 129, 0.15)',
        color: '#10b981',
      }),
    );
    pop.appendChild(assignRow);
  }

  // Block court
  pop.appendChild(makeSectionLabel(t('schedule.blockCourt')));
  const blockRow = document.createElement('div');
  blockRow.style.cssText = PILL_ROW_CSS;
  blockRow.appendChild(
    makePill('1 row', () => blockCourt(1, 'BLOCKED'), {
      icon: ICON_BAN,
      tint: TINT_DANGER,
      color: '#f43f5e',
    }),
  );
  blockRow.appendChild(
    makePill('2 rows', () => blockCourt(2, 'BLOCKED'), {
      icon: ICON_BAN,
      tint: TINT_DANGER,
      color: '#f43f5e',
    }),
  );
  blockRow.appendChild(
    makePill('3 rows', () => blockCourt(3, 'BLOCKED'), {
      icon: ICON_BAN,
      tint: TINT_DANGER,
      color: '#f43f5e',
    }),
  );
  pop.appendChild(blockRow);

  // Other booking types
  pop.appendChild(makeSectionLabel(t('schedule.otherBookings')));
  const otherRow = document.createElement('div');
  otherRow.style.cssText = PILL_ROW_CSS;
  otherRow.appendChild(
    makePill(t('schedule.practice'), () => blockCourt(1, 'PRACTICE'), {
      icon: 'fa-dumbbell',
      tint: 'rgba(59, 130, 246, 0.15)',
      color: '#3b82f6',
    }),
  );
  otherRow.appendChild(
    makePill(t('schedule.maintenance'), () => blockCourt(1, 'MAINTENANCE'), {
      icon: 'fa-wrench',
      tint: 'rgba(245, 158, 11, 0.15)',
      color: '#f59e0b',
    }),
  );
  pop.appendChild(otherRow);

  let target = e.target as HTMLElement;
  while (target && !target.dataset.courtId) target = target.parentElement as HTMLElement;
  showPopover(target || (e.target as HTMLElement), pop);
}

// ============================================================================
// Row Number Popover (bulk actions across all matchUps in the row)
// ============================================================================

export interface Schedule2RowContext {
  rowData: any;
  courtPrefix: string;
  courtsData: any[];
  onRefresh: () => void;
  executeMethods: (methods: any[], onRefresh: () => void) => void;
}

export function handleSchedule2RowClick(e: MouseEvent, ctx: Schedule2RowContext): void {
  const { rowData, courtPrefix, courtsData, onRefresh, executeMethods } = ctx;

  const rowMatchUps: any[] = [];
  for (let ci = 0; ci < courtsData.length; ci++) {
    const cellData = rowData[`${courtPrefix}${ci}`];
    if (cellData?.matchUpId) rowMatchUps.push(cellData);
  }
  if (!rowMatchUps.length) return;

  // Time mods, set time, and clear apply to anything not in a terminal status.
  const applicableMatchUps = rowMatchUps.filter((m: any) => !TERMINAL_MATCHUP_STATUSES.has(m.matchUpStatus));
  // Shotgun start additionally requires ≥2 participants assigned, not already in progress, no winner.
  const startableMatchUps = applicableMatchUps.filter((m: any) => {
    const participantCount = m.sides?.filter((s: any) => s?.participantId || s?.participant?.participantId).length || 0;
    return participantCount >= 2 && m.matchUpStatus !== IN_PROGRESS && !m.winningSide;
  });

  if (!applicableMatchUps.length) return;

  const applicableIds = applicableMatchUps.map((m: any) => m.matchUpId);

  const setSchedule = (schedule: any) => {
    executeMethods(
      [
        {
          params: { matchUpIds: applicableIds, schedule, removePriorValues: true },
          method: BULK_SCHEDULE_MATCHUPS,
        },
      ],
      onRefresh,
    );
  };

  const modifyTime = (modifier: string) => setSchedule({ timeModifiers: [modifier] });
  // Leaves startTime intact so matches already shotgun-started keep their actual start time.
  const clearTimeSettings = () => setSchedule({ scheduledTime: '', timeModifiers: [] });

  const setMatchTimes = () => {
    const existing = applicableMatchUps.find((m: any) => m?.schedule?.scheduledTime)?.schedule?.scheduledTime;
    timePicker({
      time: existing || '8:00 AM',
      callback: ({ time: picked }: { time: string }) => {
        const scheduledTime = tools.dateTime.convertTime(picked, true) || '';
        if (scheduledTime) setSchedule({ scheduledTime });
      },
    });
  };

  const shotgunStart = () => {
    const now = new Date();
    const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const startableIds = startableMatchUps.map((m: any) => m.matchUpId);
    executeMethods(
      [
        {
          params: { matchUpIds: startableIds, schedule: { startTime }, removePriorValues: true },
          method: BULK_SCHEDULE_MATCHUPS,
        },
        ...startableMatchUps.map((m: any) => ({
          method: SET_MATCHUP_STATUS,
          params: { matchUpId: m.matchUpId, drawId: m.drawId, outcome: { matchUpStatus: IN_PROGRESS } },
        })),
      ],
      onRefresh,
    );
  };

  // ── Build popover DOM ──
  const pop = document.createElement('div');
  pop.style.cssText = POPOVER_CSS;

  // Section: Time
  pop.appendChild(makeTimeSectionLabel());
  const timeRow = document.createElement('div');
  timeRow.style.cssText = PILL_ROW_CSS;
  timeRow.appendChild(makePill(t('schedule.setMatchTimes'), setMatchTimes, { icon: 'fa-clock' }));
  if (startableMatchUps.length) {
    timeRow.appendChild(
      makePill(`${t('schedule.shotgunStart')} (${startableMatchUps.length})`, shotgunStart, {
        icon: 'fa-bolt',
        color: COLOR_ACCENT_BLUE,
        outline: true,
      }),
    );
  }
  pop.appendChild(timeRow);

  // Section: Annotations
  pop.appendChild(makeSectionLabel(t('schedule.annotations')));
  const annoRow = document.createElement('div');
  annoRow.style.cssText = PILL_ROW_CSS;
  annoRow.appendChild(makePill(timeModifierText[FOLLOWED_BY], () => modifyTime(FOLLOWED_BY)));
  annoRow.appendChild(makePill(timeModifierText[NEXT_AVAILABLE], () => modifyTime(NEXT_AVAILABLE)));
  annoRow.appendChild(makePill(timeModifierText[NOT_BEFORE], () => modifyTime(NOT_BEFORE)));
  annoRow.appendChild(makePill(timeModifierText[AFTER_REST], () => modifyTime(AFTER_REST)));
  annoRow.appendChild(makePill(timeModifierText[TO_BE_ANNOUNCED], () => modifyTime(TO_BE_ANNOUNCED)));
  annoRow.appendChild(makePill(t('schedule.clearTimeSettings'), clearTimeSettings, { icon: 'fa-xmark' }));
  pop.appendChild(annoRow);

  showPopover(e.target as HTMLElement, pop);
}

// ============================================================================
// "Now" Row Popover (bulk actions across the active strip)
// ============================================================================

/**
 * One occupied active-strip cell (LIVE, SUSP, or NEXT) for a visible court.
 * Built by gridView from computeActiveStrip so this set == exactly what the
 * strip shows.
 */
export interface NowStripCell {
  matchUpId: string;
  drawId?: string;
  /** Current court — the re-seat target when rescheduling to another date. */
  courtId?: string;
  /** Draw round — orders same-draw matches when re-seating on the new date. */
  roundNumber?: number;
  matchUpStatus?: string;
  winningSide?: number;
  /** ActiveStripCellState — occupied cells are 'in-progress', 'suspended', or 'next'. */
  state: string;
  participantIds: string[];
  sides?: any[];
  courtName: string;
}

export interface Schedule2NowContext {
  /** Occupied strip cells, one per visible court. */
  cells: NowStripCell[];
  onRefresh: () => void;
  executeMethods: (methods: any[], onRefresh: () => void) => void;
  /**
   * Builds the ActiveStripGrid for an arbitrary date (all courts) so a
   * reschedule can re-seat moved matchUps against the target date's schedule.
   * Absent → reschedule falls back to a plain bulk set (court/row preserved).
   */
  buildDateGrid?: (date: string) => any;
}

function nowCellLabel(cell: NowStripCell): string {
  const names = (cell.sides ?? [])
    .map((s: any) => s?.participant?.participantName || s?.participantName)
    .filter(Boolean);
  const versus = names.length ? names.join(' – ') : cell.matchUpId;
  return cell.courtName ? `${cell.courtName} · ${versus}` : versus;
}

function currentClockTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * Build the schedule mutations for a "Now" reschedule.
 *
 * Time-only (no date change), or no grid builder available → one bulk set that
 * preserves each match's court + row. When a new date is chosen, each match is
 * re-seated on its SAME court in the target date's grid via
 * computeReschedulePlacements: placed matches get a recomputed courtOrder;
 * matches with no legal row have their court cleared so they drop into the
 * scheduled catalog for that day (keeping the new date/time).
 */
function buildRescheduleMethods(
  moving: NowStripCell[],
  schedule: { scheduledDate?: string; scheduledTime?: string },
  buildDateGrid?: (date: string) => any,
): any[] {
  const { scheduledDate, scheduledTime } = schedule;
  const baseSchedule: any = {};
  if (scheduledDate) baseSchedule.scheduledDate = scheduledDate;
  if (scheduledTime) baseSchedule.scheduledTime = scheduledTime;

  if (!scheduledDate || !buildDateGrid) {
    return [
      {
        method: BULK_SCHEDULE_MATCHUPS,
        params: { matchUpIds: moving.map((m) => m.matchUpId), schedule: baseSchedule, removePriorValues: true },
      },
    ];
  }

  const targetGrid = buildDateGrid(scheduledDate);
  const candidates = moving.map((m) => ({
    matchUpId: m.matchUpId,
    courtId: m.courtId,
    drawId: m.drawId,
    roundNumber: m.roundNumber,
    participantIds: m.participantIds,
  }));
  const placementById = new Map(computeReschedulePlacements(targetGrid, candidates).map((p) => [p.matchUpId, p]));

  return moving.map((m) => {
    const placement = placementById.get(m.matchUpId);
    const matchSchedule: any = { ...baseSchedule };
    if (placement?.placed && placement.rowIndex !== undefined) {
      matchSchedule.courtOrder = placement.rowIndex + 1; // keep court, recompute row
    } else {
      // No legal row on the target date → clear the court; the match keeps its
      // new date/time and surfaces in the scheduled catalog for hand-placing.
      matchSchedule.courtId = '';
      matchSchedule.venueId = '';
      matchSchedule.courtOrder = '';
    }
    return {
      method: ADD_MATCHUP_SCHEDULE_ITEMS,
      params: { matchUpId: m.matchUpId, drawId: m.drawId, schedule: matchSchedule, removePriorValues: true },
    };
  });
}

export function handleActiveStripNowClick(e: MouseEvent, ctx: Schedule2NowContext): void {
  const { cells, onRefresh, executeMethods, buildDateGrid } = ctx;

  // A match shown on the strip isn't necessarily flagged IN_PROGRESS — a TD may
  // drag a match to Now intending to start it and never press [Start match], so
  // it still reads NEXT. Treat every occupied strip cell as fair game for the
  // bulk actions; only terminal/decided matchUps are excluded.
  const actionable = cells.filter((c) => !TERMINAL_MATCHUP_STATUSES.has(c.matchUpStatus ?? '') && !c.winningSide);

  const startable = actionable.filter(
    (c) => c.matchUpStatus !== IN_PROGRESS && c.matchUpStatus !== SUSPENDED && c.participantIds.length >= 2,
  );
  const suspendable = actionable.filter((c) => c.matchUpStatus !== SUSPENDED);
  const resumable = actionable.filter((c) => c.matchUpStatus === SUSPENDED);

  const setStatusFor = (list: NowStripCell[], matchUpStatus: string) => {
    if (!list.length) return;
    executeMethods(
      list.map((c) => ({
        method: SET_MATCHUP_STATUS,
        params: { matchUpId: c.matchUpId, drawId: c.drawId, outcome: { matchUpStatus } },
      })),
      onRefresh,
    );
  };

  const startAll = () => {
    if (!startable.length) return;
    const startTime = currentClockTime();
    executeMethods(
      [
        {
          method: BULK_SCHEDULE_MATCHUPS,
          params: { matchUpIds: startable.map((c) => c.matchUpId), schedule: { startTime }, removePriorValues: true },
        },
        ...startable.map((c) => ({
          method: SET_MATCHUP_STATUS,
          params: { matchUpId: c.matchUpId, drawId: c.drawId, outcome: { matchUpStatus: IN_PROGRESS } },
        })),
      ],
      onRefresh,
    );
  };

  const suspendAll = () => setStatusFor(suspendable, SUSPENDED);
  const resumeAll = () => setStatusFor(resumable, IN_PROGRESS);

  const rescheduleAll = () => {
    openRescheduleNowModal(actionable, (matchUpIds, schedule) => {
      const checked = new Set(matchUpIds);
      const moving = actionable.filter((c) => checked.has(c.matchUpId));
      executeMethods(buildRescheduleMethods(moving, schedule, buildDateGrid), onRefresh);
    });
  };

  // Unschedule = clear court + time + date for every active strip matchUp. Uses
  // ADD_MATCHUP_SCHEDULE_ITEMS per matchUp (mirrors the single-cell remove) so a
  // rain-cancelled session can be fully cleared before rebuilding the schedule.
  const unscheduleAll = () => {
    if (!actionable.length) return;
    confirmModal({
      title: t('schedule.unscheduleAllTitle'),
      query: t('schedule.unscheduleAllConfirm', {
        count: actionable.length,
        defaultValue: 'Remove the date, time and court for {{count}} match(es)? They return to the unscheduled catalog; their results are untouched.',
      }),
      okIntent: 'is-warning',
      okAction: () => {
        executeMethods(
          actionable.map((c) => ({
            method: ADD_MATCHUP_SCHEDULE_ITEMS,
            params: {
              matchUpId: c.matchUpId,
              drawId: c.drawId,
              schedule: { scheduledTime: '', scheduledDate: '', courtOrder: '', venueId: '', courtId: '' },
              removePriorValues: true,
            },
          })),
          onRefresh,
        );
      },
    });
  };

  // ── Build popover DOM ──
  const pop = document.createElement('div');
  pop.style.cssText = POPOVER_CSS;

  if (!actionable.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size: 0.75rem; color: var(--tmx-muted); font-style: italic;';
    empty.textContent = t('schedule.noActiveMatches');
    pop.appendChild(empty);
    showPopover(e.target as HTMLElement, pop);
    return;
  }

  pop.appendChild(makeSectionLabel(t('schedule.status')));
  const statusRow = document.createElement('div');
  statusRow.style.cssText = PILL_ROW_CSS;
  if (startable.length) {
    statusRow.appendChild(
      makePill(`${t('schedule.startAll')} (${startable.length})`, startAll, {
        icon: 'fa-play',
        color: COLOR_ACCENT_BLUE,
      }),
    );
  }
  if (suspendable.length) {
    statusRow.appendChild(
      makePill(`${t('schedule.suspendAll')} (${suspendable.length})`, suspendAll, {
        icon: 'fa-pause',
        color: COLOR_ACCENT_ORANGE,
        outline: true,
      }),
    );
  }
  if (resumable.length) {
    statusRow.appendChild(
      makePill(`${t('schedule.resumeAll')} (${resumable.length})`, resumeAll, {
        icon: 'fa-circle-play',
        color: COLOR_ACCENT_BLUE,
        outline: true,
      }),
    );
  }
  pop.appendChild(statusRow);

  pop.appendChild(makeTimeSectionLabel());
  const timeRow = document.createElement('div');
  timeRow.style.cssText = PILL_ROW_CSS;
  timeRow.appendChild(
    makePill(`${t('schedule.rescheduleAll')} (${actionable.length})`, rescheduleAll, { icon: 'fa-clock' }),
  );
  timeRow.appendChild(
    makePill(`${t('schedule.unscheduleAll')} (${actionable.length})`, unscheduleAll, {
      icon: 'fa-calendar-xmark',
      color: COLOR_ACCENT_ORANGE,
      outline: true,
    }),
  );
  pop.appendChild(timeRow);

  showPopover(e.target as HTMLElement, pop);
}

/**
 * Attach an inline vanillajs-datepicker to a live input, constrained to
 * `futureDates` (tournament dates >= today). MUST run after the input is in the
 * DOM — constructing against a detached node leaves the show-on-focus listeners
 * unwired, so the field looks inert (clicking does nothing). Kept module-level
 * so its `datesDisabled` closure doesn't deepen the modal builder's nesting.
 */
function attachRescheduleDatepicker(input: HTMLInputElement, futureDates: string[], onPick: (date: string) => void): void {
  const activeDatesSet = futureDates.length ? new Set(futureDates) : undefined;
  new Datepicker(input, { // NOSONAR — instance attaches to DOM element
    format: 'yyyy-mm-dd',
    language: i18next.language,
    autohide: true,
    todayHighlight: true,
    ...(activeDatesSet && {
      datesDisabled: (dpDate: Date) => {
        const y = dpDate.getFullYear();
        const m = String(dpDate.getMonth() + 1).padStart(2, '0');
        const d = String(dpDate.getDate()).padStart(2, '0');
        return !activeDatesSet.has(`${y}-${m}-${d}`);
      },
      minDate: futureDates[0],
      maxDate: futureDates.at(-1),
    }),
  });
  input.addEventListener('changeDate', () => onPick(input.value));
}

/**
 * Reschedule modal for the "Now" row: multi-select the strip matchUps and apply
 * a new scheduledDate and/or scheduledTime via BULK_SCHEDULE_MATCHUPS. All rows
 * checked by default; the caller commits only the checked ids. Either field may
 * be set independently — a rain delay pushes date (and usually a fresh start
 * time) forward; a same-day shift changes only the time. The date picker is
 * constrained to tournament dates from today onward.
 */
function openRescheduleNowModal(
  candidates: NowStripCell[],
  onApply: (matchUpIds: string[], schedule: { scheduledDate?: string; scheduledTime?: string }) => void,
): void {
  const state: { scheduledDate: string; scheduledTime: string } = { scheduledDate: '', scheduledTime: '' };
  const checks: HTMLInputElement[] = [];
  const today = tools.dateTime.formatDate(new Date());
  const scheduleDates = getScheduleDateRange();
  // Prefer dates from today onward; fall back to the full tournament range so a
  // past/mock event (all dates behind "today") still gets a usable date field
  // rather than a dead disabled control.
  const futureDates = scheduleDates.filter((d) => d >= today);
  const pickerDates = futureDates.length ? futureDates : scheduleDates;

  const content = document.createElement('div');
  content.style.cssText = 'font-size: 0.8125rem; min-width: 320px;';

  // Date + time selector row. The date uses an INLINE (non-modal) datepicker
  // whose floating calendar overlays the reschedule modal — a nested baseModal
  // datePicker would close the shared cModal backdrop and tear down the whole
  // stack. The date is constrained to tournament dates >= today.
  const pickerRow = document.createElement('div');
  pickerRow.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-bottom: 10px;';

  const dateInput = document.createElement('input');
  dateInput.type = 'text';
  dateInput.className = 'input is-small';
  dateInput.style.maxWidth = '150px';
  dateInput.placeholder = t('schedule.chooseDate');
  dateInput.readOnly = true;
  dateInput.disabled = !pickerDates.length;
  pickerRow.appendChild(dateInput);

  const timeBtn = document.createElement('button');
  timeBtn.className = 'button is-small';
  timeBtn.textContent = t('schedule.chooseTime');
  timeBtn.addEventListener('click', () => {
    timePicker({
      time: state.scheduledTime ? secondsToTimeString(timeStringToSeconds(state.scheduledTime)) : '8:00 AM',
      callback: ({ time }: { time: string }) => {
        const converted = tools.dateTime.convertTime(time, true) || '';
        if (!converted) return;
        state.scheduledTime = converted as string;
        timeBtn.textContent = time;
      },
    });
  });
  pickerRow.appendChild(timeBtn);
  content.appendChild(pickerRow);

  // Divider
  const hr = document.createElement('hr');
  hr.style.cssText = 'border: none; border-top: 1px solid var(--tmx-border-primary); margin: 8px 0;';
  content.appendChild(hr);

  // Select all / none
  const selectRow = document.createElement('div');
  selectRow.style.cssText = 'display: flex; gap: 12px; margin-bottom: 6px; font-size: 0.75rem;';
  const setAll = (checked: boolean) => () => checks.forEach((c) => (c.checked = checked));
  for (const [labelKey, checked] of [
    ['schedule.selectAll', true],
    ['schedule.selectNone', false],
  ] as const) {
    const link = document.createElement('a');
    link.textContent = t(labelKey);
    link.style.cursor = 'pointer';
    link.addEventListener('click', setAll(checked));
    selectRow.appendChild(link);
  }
  content.appendChild(selectRow);

  // Candidate checklist
  const list = document.createElement('div');
  list.style.cssText = 'max-height: 260px; overflow-y: auto;';
  for (const candidate of candidates) {
    const rowEl = document.createElement('label');
    rowEl.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer;';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = true;
    check.dataset.matchUpId = candidate.matchUpId;
    checks.push(check);
    const text = document.createElement('span');
    text.textContent = nowCellLabel(candidate);
    rowEl.appendChild(check);
    rowEl.appendChild(text);
    list.appendChild(rowEl);
  }
  content.appendChild(list);

  const apply = () => {
    const matchUpIds = checks.filter((c) => c.checked).map((c) => c.dataset.matchUpId as string);
    const schedule: { scheduledDate?: string; scheduledTime?: string } = {};
    if (state.scheduledDate) schedule.scheduledDate = state.scheduledDate;
    if (state.scheduledTime) schedule.scheduledTime = state.scheduledTime;
    if (!matchUpIds.length || (!schedule.scheduledDate && !schedule.scheduledTime)) return;
    onApply(matchUpIds, schedule);
    closeModal();
  };

  openModal({
    title: t('schedule.rescheduleNowTitle'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('schedule.reschedule'), intent: 'is-info', onClick: apply, close: false },
    ],
  });

  // Wire the datepicker only once the modal (and its input) is live in the DOM
  // — vanillajs-datepicker inserts its calendar next to the input, so the input
  // must already have a parent, which it only does after openModal appends it.
  if (pickerDates.length) {
    requestAnimationFrame(() => {
      attachRescheduleDatepicker(dateInput, pickerDates, (date) => {
        state.scheduledDate = date;
      });
    });
  }
}

// ============================================================================
// Shift Courts Down (make room above already-placed matchUps)
// ============================================================================

/**
 * Modal to shift one or more courts' placed matchUps down by N grid rows,
 * freeing the top N rows so previous-day rain-delayed matches can be inserted
 * ABOVE an already-placed day. Courts default to all-selected; the caller does
 * the courtOrder += N mutation for the checked courts.
 */
export function openShiftCourtsModal(
  courts: { courtId: string; label: string }[],
  onApply: (courtIds: string[], rows: number) => void,
): void {
  const state = { rows: 1 };
  const checks: HTMLInputElement[] = [];

  const content = document.createElement('div');
  content.style.cssText = 'font-size: 0.8125rem; min-width: 300px;';

  // Rows-to-shift stepper
  const rowsRow = document.createElement('div');
  rowsRow.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-bottom: 10px;';
  const rowsLabel = document.createElement('span');
  rowsLabel.style.cssText = 'font-weight: 600;';
  rowsLabel.textContent = t('schedule.shiftRows');
  const rowsInput = document.createElement('input');
  rowsInput.type = 'number';
  rowsInput.className = 'input is-small';
  rowsInput.min = '1';
  rowsInput.value = '1';
  rowsInput.style.maxWidth = '70px';
  rowsInput.addEventListener('change', () => {
    const n = Number.parseInt(rowsInput.value, 10);
    state.rows = Number.isNaN(n) || n < 1 ? 1 : n;
    rowsInput.value = String(state.rows);
  });
  rowsRow.appendChild(rowsLabel);
  rowsRow.appendChild(rowsInput);
  content.appendChild(rowsRow);

  const hr = document.createElement('hr');
  hr.style.cssText = 'border: none; border-top: 1px solid var(--tmx-border-primary); margin: 8px 0;';
  content.appendChild(hr);

  // Select all / none
  const selectRow = document.createElement('div');
  selectRow.style.cssText = 'display: flex; gap: 12px; margin-bottom: 6px; font-size: 0.75rem;';
  const setAll = (checked: boolean) => () => checks.forEach((c) => (c.checked = checked));
  for (const [labelKey, checked] of [
    ['schedule.selectAll', true],
    ['schedule.selectNone', false],
  ] as const) {
    const link = document.createElement('a');
    link.textContent = t(labelKey);
    link.style.cursor = 'pointer';
    link.addEventListener('click', setAll(checked));
    selectRow.appendChild(link);
  }
  content.appendChild(selectRow);

  // Court checklist (all courts checked by default)
  const list = document.createElement('div');
  list.style.cssText = 'max-height: 260px; overflow-y: auto;';
  for (const court of courts) {
    const rowEl = document.createElement('label');
    rowEl.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer;';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = true;
    check.dataset.courtId = court.courtId;
    checks.push(check);
    const text = document.createElement('span');
    text.textContent = court.label;
    rowEl.appendChild(check);
    rowEl.appendChild(text);
    list.appendChild(rowEl);
  }
  content.appendChild(list);

  const apply = () => {
    const courtIds = checks.filter((c) => c.checked).map((c) => c.dataset.courtId as string);
    if (!courtIds.length || state.rows < 1) return;
    onApply(courtIds, state.rows);
    closeModal();
  };

  openModal({
    title: t('schedule.shiftCourtsTitle'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('schedule.shift'), intent: 'is-info', onClick: apply, close: false },
    ],
  });
}

// ============================================================================
// Blocked Cell Popover
// ============================================================================

function showBlockedCellMenu(e: MouseEvent, ctx: Schedule2CellContext): void {
  const { cellData, courtId, scheduledDate, onRefresh } = ctx;
  const booking = cellData?.booking;
  if (!courtId || !booking?.courtOrder) return;

  const unblockCourt = () => {
    mutationRequest({
      methods: [
        { method: 'removeCourtGridBooking', params: { courtId, scheduledDate, courtOrder: booking.courtOrder } },
      ],
      callback: (result: any) => {
        if (result.success) onRefresh();
      },
    });
  };

  const rowText = booking.rowCount > 1 ? `${booking.rowCount} rows` : '1 row';
  const bookingLabel = booking.bookingType || 'BLOCKED';

  const pop = document.createElement('div');
  pop.style.cssText = POPOVER_CSS;
  const row = document.createElement('div');
  row.style.cssText = PILL_ROW_CSS;
  row.appendChild(
    makePill(`Unblock (${rowText}, ${bookingLabel})`, unblockCourt, {
      icon: 'fa-unlock',
      color: COLOR_ACCENT_ORANGE,
      outline: true,
    }),
  );
  pop.appendChild(row);

  if (booking.notes) {
    const note = document.createElement('div');
    note.style.cssText = 'font-size: 0.625rem; color: var(--tmx-muted); font-style: italic; padding-top: 4px;';
    note.textContent = `Notes: ${booking.notes}`;
    pop.appendChild(note);
  }

  let target = e.target as HTMLElement;
  while (target && !target.dataset.courtId) target = target.parentElement as HTMLElement;
  showPopover(target || (e.target as HTMLElement), pop);
}
