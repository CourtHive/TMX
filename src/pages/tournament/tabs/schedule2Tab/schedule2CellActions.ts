/**
 * Schedule2 grid cell click actions.
 *
 * Provides popover menus for matchUp cells, empty cells, and blocked cells
 * in the schedule2 CSS grid — equivalent to the Tabulator-based popovers
 * in the original schedule tab, but decoupled from Tabulator.
 */
import { secondsToTimeString, timeStringToSeconds } from 'functions/timeStrings';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { competitionEngine, timeItemConstants, tools } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { tipster } from 'components/popovers/tipster';
import { timePicker } from 'components/modals/timePicker';

import { ADD_MATCHUP_SCHEDULE_ITEMS, BULK_SCHEDULE_MATCHUPS } from 'constants/mutationConstants';
import { timeModifierText, RIGHT } from 'constants/tmxConstants';

const { AFTER_REST, FOLLOWED_BY, NEXT_AVAILABLE, NOT_BEFORE, TO_BE_ANNOUNCED } = timeItemConstants;

// ── Types ──

export interface Schedule2CellContext {
  /** Raw cellData from competitionScheduleMatchUps row (may be undefined for empty cells) */
  cellData: any;
  /** courtId from grid cell data attribute */
  courtId: string;
  /** venueId from grid cell data attribute */
  venueId: string;
  /** courtOrder (1-based row index) */
  courtOrder: number;
  /** Currently displayed schedule date */
  scheduledDate: string;
  /** All grid rows (for time picker to find previous row times) */
  allRows: any[];
  /** Court prefix used in row keys (e.g. 'C|') */
  courtPrefix: string;
  /** Row index (0-based) of the clicked cell within allRows */
  rowIndex: number;
  /** Callback to refresh the grid after mutations */
  onRefresh: () => void;
  /** Execute mutations (respects bulk mode) */
  executeMethods: (methods: any[], onRefresh: () => void) => void;
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

// ── MatchUp cell popover ──

function showMatchUpCellMenu(e: MouseEvent, ctx: Schedule2CellContext): void {
  const { cellData, allRows, courtPrefix, rowIndex, onRefresh, executeMethods } = ctx;
  const matchUpId = cellData.matchUpId;

  // Fetch the full matchUp from factory for score entry / navigation
  const fullMatchUp = competitionEngine.allTournamentMatchUps({
    matchUpFilters: { matchUpIds: [matchUpId] },
    inContext: true,
    nextMatchUps: true,
  })?.matchUps?.[0];

  const matchUp = fullMatchUp || cellData;

  const setSchedule = (schedule: any) => {
    const methods = [
      {
        params: { matchUpIds: [matchUpId], schedule, removePriorValues: true },
        method: BULK_SCHEDULE_MATCHUPS,
      },
    ];
    mutationRequest({
      methods,
      callback: (result: any) => {
        if (result.success) onRefresh();
      },
    });
  };

  const timeSelected = ({ time }: { time: string }) => {
    const militaryTime = true;
    const scheduledTime = tools.dateTime.convertTime(time, militaryTime) || '';
    setSchedule({ scheduledTime });
  };

  const setMatchUpTime = () => {
    // Gather scheduled times from rows before the clicked row to suggest a sensible default
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

  const scoreMatchUp = () => {
    enterMatchUpScore({ matchUp, matchUpId, callback: () => onRefresh() });
  };

  const viewDraw = () => {
    const drawId = matchUp?.drawId || cellData.drawId;
    const eventId = matchUp?.eventId || cellData.eventId;
    if (!drawId || !eventId) return;
    navigateToEvent({ eventId, drawId, renderDraw: true });
  };

  const removeFromSchedule = () => {
    const drawId = matchUp?.drawId || cellData.drawId || '';
    const methods = [
      {
        method: ADD_MATCHUP_SCHEDULE_ITEMS,
        params: {
          matchUpId,
          drawId,
          schedule: { scheduledTime: '', scheduledDate: '', courtOrder: '', venueId: '', courtId: '' },
          removePriorValues: true,
        },
      },
    ];
    executeMethods(methods, onRefresh);
  };

  const hasCourtId = matchUp?.schedule?.courtId || cellData?.schedule?.courtId;

  const options = [
    { option: 'Set match time', onClick: setMatchUpTime },
    readyToScore && { option: 'Enter score', onClick: scoreMatchUp },
    { option: timeModifierText[FOLLOWED_BY], onClick: () => modifyTime(FOLLOWED_BY) },
    { option: timeModifierText[NEXT_AVAILABLE], onClick: () => modifyTime(NEXT_AVAILABLE) },
    { option: timeModifierText[NOT_BEFORE], onClick: () => modifyTime(NOT_BEFORE) },
    { option: timeModifierText[AFTER_REST], onClick: () => modifyTime(AFTER_REST) },
    { option: timeModifierText[TO_BE_ANNOUNCED], onClick: () => modifyTime(TO_BE_ANNOUNCED) },
    { option: 'Clear time settings', onClick: clearTimeSettings },
    hasCourtId && { option: 'Remove from schedule', onClick: removeFromSchedule },
    (matchUp?.drawId || cellData.drawId) && { option: 'View draw', onClick: viewDraw },
  ].filter(Boolean);

  const target = e.target as HTMLElement;
  tipster({ options, target, config: { placement: RIGHT } });
}

// ── Empty cell popover ──

function showEmptyCellMenu(e: MouseEvent, ctx: Schedule2CellContext): void {
  const { courtId, courtOrder, scheduledDate, onRefresh } = ctx;

  if (!courtId || !courtOrder) return;

  const blockCourt = (rowCount: number, bookingType: string = 'BLOCKED') => {
    const methods = [
      {
        method: 'addCourtGridBooking',
        params: { courtId, scheduledDate, courtOrder, rowCount, bookingType },
      },
    ];
    mutationRequest({
      methods,
      callback: (result: any) => {
        if (result.success) onRefresh();
      },
    });
  };

  const options = [
    { option: 'Block court (1 row)', onClick: () => blockCourt(1, 'BLOCKED') },
    { option: 'Block court (2 rows)', onClick: () => blockCourt(2, 'BLOCKED') },
    { option: 'Block court (3 rows)', onClick: () => blockCourt(3, 'BLOCKED') },
    { option: 'Mark court for practice (1 row)', onClick: () => blockCourt(1, 'PRACTICE') },
    { option: 'Mark court for maintenance (1 row)', onClick: () => blockCourt(1, 'MAINTENANCE') },
  ];

  const target = e.target as HTMLElement;
  tipster({ options, target, config: { placement: RIGHT } });
}

// ── Blocked cell popover ──

function showBlockedCellMenu(e: MouseEvent, ctx: Schedule2CellContext): void {
  const { cellData, courtId, scheduledDate, onRefresh } = ctx;
  const booking = cellData?.booking;

  if (!courtId || !booking?.courtOrder) return;

  const unblockCourt = () => {
    const methods = [
      {
        method: 'removeCourtGridBooking',
        params: { courtId, scheduledDate, courtOrder: booking.courtOrder },
      },
    ];
    mutationRequest({
      methods,
      callback: (result: any) => {
        if (result.success) onRefresh();
      },
    });
  };

  const rowText = booking.rowCount > 1 ? `${booking.rowCount} rows` : '1 row';
  const bookingLabel = booking.bookingType || 'BLOCKED';

  const options = [
    { option: `Unblock court (${rowText}, ${bookingLabel})`, onClick: unblockCourt },
    booking.notes && { option: `Notes: ${booking.notes}`, disabled: true },
  ].filter(Boolean);

  const target = e.target as HTMLElement;
  tipster({ options, target, config: { placement: RIGHT } });
}
