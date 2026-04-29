/**
 * Schedule2 grid cell click actions.
 *
 * Provides sectioned popover menus for matchUp cells, empty cells, and blocked cells
 * in the schedule2 CSS grid. Uses tippy.js directly with custom DOM for a modern
 * pill/icon layout rather than the legacy flat menu list.
 */
import { competitionEngine, matchUpStatusConstants, timeItemConstants, tools } from 'tods-competition-factory';
import { secondsToTimeString, timeStringToSeconds } from 'functions/timeStrings';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { printMatchUpCourtCard } from 'components/modals/printCourtCards';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { activateScheduleCellTypeAhead } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { destroyTipster } from 'components/popovers/tipster';
import { timePicker } from 'components/modals/timePicker';
import tippy, { type Instance } from 'tippy.js';
import { t } from 'i18n';

// constants
import { ADD_MATCHUP_SCHEDULE_ITEMS, BULK_SCHEDULE_MATCHUPS, SET_MATCHUP_STATUS } from 'constants/mutationConstants';
import { timeModifierText, RIGHT } from 'constants/tmxConstants';

const { AFTER_REST, FOLLOWED_BY, NEXT_AVAILABLE, NOT_BEFORE, TO_BE_ANNOUNCED } = timeItemConstants;
const { IN_PROGRESS } = matchUpStatusConstants;

const COLOR_ACCENT_BLUE = 'var(--tmx-accent-blue, #3b82f6)';
const ICON_BAN = 'fa-ban';
const TINT_DANGER = 'rgba(244, 63, 94, 0.15)';

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
  'font-size: 12px',
].join('; ');

const SECTION_LABEL_CSS = [
  'font-size: 9px',
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
    'font-size: 11px',
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
  if (opts?.icon) btn.innerHTML = `<i class="fa-solid ${opts.icon}" style="font-size: 10px;"></i>${label}`;
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
    'font-size: 13px',
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
  const hideTimeActions = noParticipants || isTerminal;
  const hideStartMatch = hideTimeActions || isInProgress || matchUp?.winningSide;

  const scoreMatchUp = () => enterMatchUpScore({ matchUp, matchUpId, callback: () => onRefresh() });

  const viewDraw = () => {
    const drawId = matchUp?.drawId || cellData.drawId;
    const eventId = matchUp?.eventId || cellData.eventId;
    if (drawId && eventId) navigateToEvent({ eventId, drawId, renderDraw: true });
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
  pop.appendChild(makeSectionLabel(t('schedule.time')));
  const timeRow = document.createElement('div');
  timeRow.style.cssText = PILL_ROW_CSS;
  timeRow.appendChild(makePill(t('schedule.setTime'), setMatchUpTime, { icon: 'fa-clock' }));
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
        color: 'var(--tmx-accent-orange, #ef4444)',
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

// ── Row number click (shotgun start) ──

export interface Schedule2RowContext {
  rowData: any;
  courtPrefix: string;
  courtsData: any[];
  onRefresh: () => void;
  executeMethods: (methods: any[], onRefresh: () => void) => void;
}

export function handleSchedule2RowClick(e: MouseEvent, ctx: Schedule2RowContext): void {
  const { rowData, courtPrefix, courtsData, onRefresh, executeMethods } = ctx;

  const terminalStatuses = new Set([
    'BYE',
    'WALKOVER',
    'DOUBLE_WALKOVER',
    'CANCELLED',
    'ABANDONED',
    'DOUBLE_DEFAULT',
    'DEFAULTED',
  ]);

  const rowMatchUps: any[] = [];
  for (let ci = 0; ci < courtsData.length; ci++) {
    const cellData = rowData[`${courtPrefix}${ci}`];
    if (cellData?.matchUpId) rowMatchUps.push(cellData);
  }
  if (!rowMatchUps.length) return;

  const startableMatchUps = rowMatchUps.filter((m: any) => {
    const status = m.matchUpStatus;
    const participantCount = m.sides?.filter((s: any) => s?.participantId || s?.participant?.participantId).length || 0;
    return participantCount >= 2 && !terminalStatuses.has(status) && status !== IN_PROGRESS && !m.winningSide;
  });

  if (!startableMatchUps.length) return;

  const shotgunStart = () => {
    const now = new Date();
    const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const matchUpIds = startableMatchUps.map((m: any) => m.matchUpId);
    executeMethods(
      [
        { params: { matchUpIds, schedule: { startTime }, removePriorValues: true }, method: BULK_SCHEDULE_MATCHUPS },
        ...startableMatchUps.map((m: any) => ({
          method: SET_MATCHUP_STATUS,
          params: { matchUpId: m.matchUpId, drawId: m.drawId, outcome: { matchUpStatus: IN_PROGRESS } },
        })),
      ],
      onRefresh,
    );
  };

  const pop = document.createElement('div');
  pop.style.cssText = POPOVER_CSS;
  const row = document.createElement('div');
  row.style.cssText = PILL_ROW_CSS;
  row.appendChild(
    makePill(`Shotgun start (${startableMatchUps.length})`, shotgunStart, {
      icon: 'fa-bolt',
      color: COLOR_ACCENT_BLUE,
      outline: true,
    }),
  );
  pop.appendChild(row);

  showPopover(e.target as HTMLElement, pop);
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
      color: 'var(--tmx-accent-orange, #ef4444)',
      outline: true,
    }),
  );
  pop.appendChild(row);

  if (booking.notes) {
    const note = document.createElement('div');
    note.style.cssText = 'font-size: 10px; color: var(--tmx-muted); font-style: italic; padding-top: 4px;';
    note.textContent = `Notes: ${booking.notes}`;
    pop.appendChild(note);
  }

  let target = e.target as HTMLElement;
  while (target && !target.dataset.courtId) target = target.parentElement as HTMLElement;
  showPopover(target || (e.target as HTMLElement), pop);
}
