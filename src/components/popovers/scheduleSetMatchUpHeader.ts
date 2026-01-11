/**
 * Schedule set matchUp header popover.
 * Provides options for setting match times, modifiers, and entering scores.
 */
import { secondsToTimeString, timeStringToSeconds } from 'functions/timeStrings';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { timeItemConstants, tools } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { tipster } from 'components/popovers/tipster';
import { timePicker } from '../modals/timePicker';
import { isFunction } from 'functions/typeOf';

import { BULK_SCHEDULE_MATCHUPS } from 'constants/mutationConstants';
import { timeModifierText, RIGHT } from 'constants/tmxConstants';

const { AFTER_REST, FOLLOWED_BY, NEXT_AVAILABLE, NOT_BEFORE, TO_BE_ANNOUNCED } = timeItemConstants;

export function scheduleSetMatchUpHeader({ e, cell, callback, matchUpId, rowData: providedRowData }: { e: Event; cell: any; callback?: (schedule: any) => void; matchUpId?: string; rowData?: any } = {} as any): void {
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

  const viewDraw = () => {
    if (!matchUp?.drawId || !matchUp?.eventId) return;
    
    // Navigate to the draw view for this matchUp using the proper navigation function
    navigateToEvent({
      eventId: matchUp.eventId,
      drawId: matchUp.drawId,
      renderDraw: true,
    });
  };

  const options = [
    {
      option: setMatchTimeText,
      onClick: setMatchUpTimes,
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
    matchUp?.drawId && {
      option: 'View draw',
      onClick: viewDraw,
    },
  ].filter(Boolean);

  const target = e.target as HTMLElement;
  tipster({ options, target, config: { placement: RIGHT } });
}
