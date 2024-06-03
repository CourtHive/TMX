import { secondsToTimeString, timeStringToSeconds } from 'functions/timeStrings';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { timeItemConstants, tools } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tipster } from 'components/popovers/tipster';
import { timePicker } from '../modals/timePicker';
import { isFunction } from 'functions/typeOf';

import { BULK_SCHEDULE_MATCHUPS } from 'constants/mutationConstants';
import { timeModifierText, RIGHT } from 'constants/tmxConstants';

const { AFTER_REST, FOLLOWED_BY, NEXT_AVAILABLE, NOT_BEFORE, TO_BE_ANNOUNCED } = timeItemConstants;

export function scheduleSetMatchUpHeader({ e, cell, callback, matchUpId } = {}) {
  const rowData = cell.getRow().getData();
  /*
  let options = [
    { label: lang.tr('schedule.matchestime'), value: 'matchestime' },
    { label: lang.tr('schedule.raindelay'), value: 'raindelay' },
    { label: lang.tr('schedule.tba'), value: 'tba' },
    { label: lang.tr('schedule.nextavailable'), value: 'next' },
  ];

  listPicker({ options, callback, isOpen: true });
  */

  const setSchedule = (schedule) => {
    const matchUps = Object.values(rowData).filter((c) => c?.matchUpId);
    const matchUpIds = matchUpId ? [matchUpId] : matchUps.map(({ matchUpId }) => matchUpId);

    const methods = [
      {
        params: { matchUpIds, schedule, removePriorValues: true },
        method: BULK_SCHEDULE_MATCHUPS,
      },
    ];

    const postMutation = (result) => {
      if (result.success) {
        isFunction(callback) && callback(schedule);
      }
    };

    mutationRequest({ methods, callback: postMutation });
  };

  const scoreMatchUp = (matchUp) => enterMatchUpScore({ matchUp, matchUpId, callback });

  const clearTimeSettings = () => setSchedule({ scheduledTime: '', timeModifiers: [] });
  const timeSelected = ({ time }) => {
    const militaryTime = true;
    const scheduledTime = tools.dateTime.convertTime(time, militaryTime);
    setSchedule({ scheduledTime });
  };

  const setMatchUpTimes = () => {
    const table = cell.getTable();
    const tableData = table.getData();
    let rowEncountered;

    const previousRowScheduledTimes = tableData
      .flatMap((row, i) => {
        if (rowEncountered) return;
        if (row.rowId === rowData.rowId) {
          rowEncountered = i + 1;
          if (i) return;
        }
        return Object.values(row).flatMap((c) => c?.schedule?.scheduledTime);
      })
      .filter(Boolean)
      .map(timeStringToSeconds);
    const maxSeconds = Math.max(...previousRowScheduledTimes, 0); // zero prevents -Infinity

    const nextHour = rowEncountered > 1;
    const time = (maxSeconds && secondsToTimeString(maxSeconds, nextHour)) || '8:00 AM';
    timePicker({ time, callback: timeSelected /*, options: { disabledTime: { hours: [11, 12] } }*/ });
  };

  const modifyTime = (modifier) => setSchedule({ timeModifiers: [modifier] });

  const setMatchTimeText = matchUpId ? 'Set match time' : 'Set match times';
  const matchUp = Object.values(cell.getData()).find((c) => c?.matchUpId === matchUpId);
  const readyToScore = matchUp?.readyToScore || matchUp?.winningSide || matchUp?.score?.sets;

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
  ].filter(Boolean);

  const target = e.target;
  tipster({ options, target, config: { placement: RIGHT } });
}
