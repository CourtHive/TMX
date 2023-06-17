import { mutationRequest } from 'services/mutation/mutationRequest';
import { secondsToTimeString, timeStringToSeconds } from 'functions/timeStrings';
import { tipster } from 'components/popovers/tipster';
import { utilities } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';
import { timePicker } from './timePicker';

import { BULK_SCHEDULE_MATCHUPS } from 'constants/mutationConstants';
import { RIGHT } from 'constants/tmxConstants';

export function scheduleSetMatchUpHeader({ e, cell, rowData, callback } = {}) {
  /*
  let options = [
    { label: lang.tr('schedule.matchestime'), value: 'matchestime' },
    { label: lang.tr('schedule.notbefore'), value: 'notbefore' },
    { label: lang.tr('schedule.followedby'), value: 'followedby' },
    { label: lang.tr('schedule.afterrest'), value: 'afterrest' },
    { label: lang.tr('schedule.raindelay'), value: 'raindelay' },
    { label: lang.tr('schedule.tba'), value: 'tba' },
    { label: lang.tr('schedule.nextavailable'), value: 'next' },
    { label: lang.tr('schedule.clear'), value: 'clear' }
  ];

  listPicker({ options, callback, isOpen: true });
  */

  const timeSelected = ({ time }) => {
    const militaryTime = true;
    const scheduledTime = utilities.dateTime.convertTime(time, militaryTime);
    const matchUps = Object.values(rowData).filter((c) => c?.matchUpId);
    const matchUpIds = matchUps.map(({ matchUpId }) => matchUpId);

    const methods = [
      {
        method: BULK_SCHEDULE_MATCHUPS,
        params: {
          schedule: { scheduledTime },
          matchUpIds
        }
      }
    ];

    const postMutation = (result) => {
      if (result.success) {
        isFunction(callback && callback(scheduledTime));
      }
    };

    mutationRequest({ methods, callback: postMutation });
  };

  const setMatchUpTimes = () => {
    const table = cell.getTable();
    const tableData = table.getData();
    let rowEncountered;

    const previousRowScheduledTimes = tableData
      .flatMap((row) => {
        if (rowEncountered || row.rowId === rowData.rowId) {
          rowEncountered = true;
          return;
        }
        return Object.values(row).flatMap((c) => c?.schedule?.scheduledTime);
      })
      .filter(Boolean)
      .map(timeStringToSeconds);
    const maxSeconds = Math.max(...previousRowScheduledTimes, 0); // zero prevents -Infinity

    const nextHour = true;
    const time = (maxSeconds && secondsToTimeString(maxSeconds, nextHour)) || '8:00 AM';
    timePicker({ time, callback: timeSelected, options: { disabledTime: { hours: [11, 12] } } });
  };

  const options = [
    {
      option: `Set match times`,
      onClick: setMatchUpTimes
    }
  ];

  const target = e.target;
  tipster({ options, target, config: { placement: RIGHT } });
}
