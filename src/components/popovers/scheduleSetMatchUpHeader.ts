/**
 * Schedule set matchUp header popover.
 * Provides options for setting match times, modifiers, and entering scores.
 */
import { matchUpStatusConstants, timeItemConstants, tools } from 'tods-competition-factory';
import { secondsToTimeString, timeStringToSeconds } from 'functions/timeStrings';
import { updateConflicts } from 'components/tables/scheduleTable/updateConflicts';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { mapMatchUp } from 'pages/tournament/tabs/matchUpsTab/mapMatchUp';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { tipster } from 'components/popovers/tipster';
import { timePicker } from '../modals/timePicker';
import { isFunction } from 'functions/typeOf';

// constants
import { ADD_MATCHUP_SCHEDULE_ITEMS, BULK_SCHEDULE_MATCHUPS, SET_MATCHUP_STATUS } from 'constants/mutationConstants';
import { timeModifierText, RIGHT, COMPETITION_ENGINE, UNSCHEDULED_MATCHUPS } from 'constants/tmxConstants';

const { IN_PROGRESS } = matchUpStatusConstants;

const { AFTER_REST, FOLLOWED_BY, NEXT_AVAILABLE, NOT_BEFORE, TO_BE_ANNOUNCED } = timeItemConstants;

function findMatchUpColumnKey(rowData: any, matchUpId: string): string | undefined {
  return Object.keys(rowData).find((key) => {
    const cellData = rowData[key];
    return cellData && typeof cellData === 'object' && cellData.matchUpId === matchUpId;
  });
}

function locateScheduleRow(scheduleTable: any, matchUpId: string): { row: any; columnKey: string } | undefined {
  for (const row of scheduleTable.getRows()) {
    const data = row.getData();
    const columnKey = findMatchUpColumnKey(data, matchUpId);
    if (columnKey) return { row: data, columnKey };
  }
  return undefined;
}

export function scheduleSetMatchUpHeader(
  {
    e,
    cell,
    callback,
    matchUpId,
    rowData: providedRowData,
  }: { e: Event; cell: any; callback?: (schedule: any) => void; matchUpId?: string; rowData?: any } = {} as any,
): void {
  const rowData = providedRowData || cell.getRow().getData();

  const setSchedule = (schedule: any) => {
    const matchUps = Object.values(rowData).filter((c: any) => c?.matchUpId);
    const matchUpIds = matchUpId ? [matchUpId] : matchUps.map(({ matchUpId }: any) => matchUpId);

    const methods = [
      {
        params: { matchUpIds, schedule, removePriorValues: true },
        method: BULK_SCHEDULE_MATCHUPS,
      },
    ];

    const postMutation = (result: any) => {
      if (result.success && isFunction(callback) && callback) callback(schedule);
    };

    mutationRequest({ methods, callback: postMutation });
  };

  const scoreMatchUp = (matchUp: any) => enterMatchUpScore({ matchUp, matchUpId: matchUpId!, callback });

  const clearTimeSettings = () => setSchedule({ scheduledTime: '', timeModifiers: [] });
  const timeSelected = ({ time }: { time: string }) => {
    const militaryTime = true;
    const scheduledTime = tools.dateTime.convertTime(time, militaryTime) || '';
    setSchedule({ scheduledTime });
  };

  const setMatchUpTimes = () => {
    const table = cell.getTable();
    const tableData = table.getData();
    let rowEncountered: number | undefined;

    const previousRowScheduledTimes = tableData
      .flatMap((row: any, i: number) => {
        if (rowEncountered) return;
        if (row.rowId === rowData.rowId) {
          rowEncountered = i + 1;
          if (i) return;
        }
        return Object.values(row).flatMap((c: any) => c?.schedule?.scheduledTime);
      })
      .filter(Boolean)
      .map(timeStringToSeconds);
    const maxSeconds = Math.max(...previousRowScheduledTimes, 0);

    const nextHour = (rowEncountered ?? 0) > 1;
    const time = (maxSeconds && secondsToTimeString(maxSeconds, nextHour)) || '8:00 AM';
    timePicker({ time, callback: timeSelected });
  };

  const modifyTime = (modifier: string) => setSchedule({ timeModifiers: [modifier] });

  const setMatchTimeText = matchUpId ? 'Set match time' : 'Set match times';
  const matchUp = Object.values(cell.getData()).find((c: any) => c?.matchUpId === matchUpId) as any;
  const readyToScore = matchUp?.readyToScore || matchUp?.winningSide || matchUp?.score?.sets;

  const setStartTime = () => {
    if (!matchUpId) return;
    const existingStart = matchUp?.schedule?.startTime || '';
    timePicker({
      time: existingStart || '',
      callback: ({ time }) => {
        const startTime = tools.dateTime.convertTime(time, true) as string;
        if (!startTime) return;
        setSchedule({ startTime });
      },
    });
  };

  const setEndTime = () => {
    if (!matchUpId) return;
    const existingEnd = matchUp?.schedule?.endTime || '';
    timePicker({
      time: existingEnd || '',
      callback: ({ time }) => {
        const endTime = tools.dateTime.convertTime(time, true) as string;
        if (!endTime) return;
        setSchedule({ endTime });
      },
    });
  };

  const startMatch = () => {
    console.log('startMatch:', { matchUpId, drawId: matchUp?.drawId, matchUp });
    if (!matchUpId || !matchUp?.drawId) return;
    const now = new Date();
    const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const methods = [
      {
        params: { matchUpIds: [matchUpId], schedule: { startTime }, removePriorValues: true },
        method: BULK_SCHEDULE_MATCHUPS,
      },
      {
        method: SET_MATCHUP_STATUS,
        params: {
          matchUpId,
          drawId: matchUp.drawId,
          outcome: { matchUpStatus: IN_PROGRESS },
        },
      },
    ];
    console.log('startMatch methods:', methods);
    const postMutation = (result: any) => {
      console.log('startMatch result:', result);
      if (result.success && isFunction(callback) && callback) callback({ startTime });
    };
    mutationRequest({ methods, engine: COMPETITION_ENGINE, callback: postMutation });
  };

  const noParticipants = !matchUp?.sides?.some((s: any) => s?.participantId);
  const matchUpStatus = matchUp?.matchUpStatus;
  const terminalStatuses = new Set([
    'BYE',
    'WALKOVER',
    'DOUBLE_WALKOVER',
    'CANCELLED',
    'ABANDONED',
    'DOUBLE_DEFAULT',
    'DEFAULTED',
  ]);
  const isTerminal = terminalStatuses.has(matchUpStatus);
  const isInProgress = matchUpStatus === IN_PROGRESS;
  const hideTimeActions = !matchUpId || noParticipants || isTerminal;
  const hideStartMatch = hideTimeActions || isInProgress || matchUp?.winningSide;

  const isRowMode = !matchUpId;
  const rowMatchUps = isRowMode ? Object.values(rowData).filter((c: any) => c?.matchUpId) : [];
  const startableMatchUps = rowMatchUps.filter((m: any) => {
    const status = m.matchUpStatus;
    const participantCount = m.sides?.filter((s: any) => s?.participantId || s?.participant?.participantId).length || 0;
    const terminal = terminalStatuses.has(status);
    return participantCount >= 2 && !terminal && status !== IN_PROGRESS && !m.winningSide;
  });

  const shotgunStart = () => {
    console.log('shotgunStart:', { startableMatchUps: startableMatchUps.length, rowMatchUps: rowMatchUps.length });
    if (!startableMatchUps.length) return;
    const now = new Date();
    const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const matchUpIds = startableMatchUps.map((m: any) => m.matchUpId);
    const methods: any[] = [
      {
        params: { matchUpIds, schedule: { startTime }, removePriorValues: true },
        method: BULK_SCHEDULE_MATCHUPS,
      },
      ...startableMatchUps.map((m: any) => ({
        method: SET_MATCHUP_STATUS,
        params: {
          matchUpId: m.matchUpId,
          drawId: m.drawId,
          outcome: { matchUpStatus: IN_PROGRESS },
        },
      })),
    ];
    console.log('shotgunStart methods:', methods);
    const postMutation = (result: any) => {
      console.log('shotgunStart result:', result);
      if (result.success && isFunction(callback) && callback) callback({ startTime, matchUpIds });
    };
    mutationRequest({ methods, engine: COMPETITION_ENGINE, callback: postMutation });
  };

  const viewDraw = () => {
    if (!matchUp?.drawId || !matchUp?.eventId) return;

    // Navigate to the draw view for this matchUp using the proper navigation function
    navigateToEvent({
      eventId: matchUp.eventId,
      drawId: matchUp.drawId,
      renderDraw: true,
    });
  };

  const removeFromSchedule = () => {
    if (!matchUp?.matchUpId || !matchUp?.schedule?.courtId) return;

    const scheduleTable = cell.getTable();
    const { courtId, courtOrder, venueId } = matchUp.schedule;

    const updatedSchedule = { scheduledTime: '', scheduledDate: '', courtOrder: '', venueId: '', courtId: '' };
    const methods = [
      {
        method: ADD_MATCHUP_SCHEDULE_ITEMS,
        params: {
          tournamentId: matchUp.tournamentId,
          matchUpId: matchUp.matchUpId,
          schedule: updatedSchedule,
          drawId: matchUp.drawId,
          removePriorValues: true,
        },
      },
    ];

    const postMutation = (result: any) => {
      if (result.success) {
        matchUp.schedule = updatedSchedule;

        // Update the schedule table row to clear the matchUp
        const located = locateScheduleRow(scheduleTable, matchUp.matchUpId);
        if (located) {
          located.row[located.columnKey] = {
            schedule: { courtOrder, courtId, venueId },
          };
          scheduleTable.updateData([located.row]);
        }

        // Add to unscheduled table
        const unscheduledTable = Tabulator.findTable(`#${UNSCHEDULED_MATCHUPS}`)[0];
        if (unscheduledTable) {
          const newRow = mapMatchUp(matchUp);
          unscheduledTable.addRow(newRow, true);
        }

        updateConflicts(scheduleTable);
      }
    };

    mutationRequest({ methods, engine: COMPETITION_ENGINE, callback: postMutation });
  };

  const options = [
    {
      option: setMatchTimeText,
      onClick: setMatchUpTimes,
    },
    isRowMode &&
      startableMatchUps.length > 0 && {
        option: `Shotgun start (${startableMatchUps.length})`,
        onClick: shotgunStart,
      },
    !hideStartMatch && {
      option: 'Start match',
      onClick: startMatch,
    },
    !hideTimeActions && {
      option: 'Start time',
      onClick: setStartTime,
    },
    !hideTimeActions && {
      option: 'End time',
      onClick: setEndTime,
    },
    readyToScore && {
      option: 'Enter score',
      onClick: () => scoreMatchUp(matchUp),
    },
    {
      option: timeModifierText[FOLLOWED_BY],
      onClick: () => modifyTime(FOLLOWED_BY),
    },
    {
      option: timeModifierText[NEXT_AVAILABLE],
      onClick: () => modifyTime(NEXT_AVAILABLE),
    },
    {
      option: timeModifierText[NOT_BEFORE],
      onClick: () => modifyTime(NOT_BEFORE),
    },
    {
      option: timeModifierText[AFTER_REST],
      onClick: () => modifyTime(AFTER_REST),
    },
    {
      option: timeModifierText[TO_BE_ANNOUNCED],
      onClick: () => modifyTime(TO_BE_ANNOUNCED),
    },
    {
      option: `Clear time settings`,
      onClick: clearTimeSettings,
    },
    matchUp?.schedule?.courtId && {
      option: 'Remove from schedule',
      onClick: removeFromSchedule,
    },
    matchUp?.drawId && {
      option: 'View draw',
      onClick: viewDraw,
    },
  ].filter(Boolean);

  const target = e.target as HTMLElement;
  tipster({ options, target, config: { placement: RIGHT } });
}
