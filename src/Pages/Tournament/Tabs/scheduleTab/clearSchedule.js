import { mutationRequest } from 'services/mutation/mutationRequest';
import { competitionEngine } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';
import { tipster } from 'components/popovers/tipster';

import { BULK_SCHEDULE_MATCHUPS } from 'constants/mutationConstants';
import { BOTTOM } from 'constants/tmxConstants';

export function clearSchedule({ scheduledDate, target, roundNameFilter, eventIdFilter, callback }) {
  const result = competitionEngine.competitionScheduleMatchUps({ courtCompletedMatchUps: true });
  const { dateMatchUps = [], completedMatchUps = [] } = result;
  const matchUps = dateMatchUps.concat(...completedMatchUps);
  const scheduledMatchUps = matchUps.filter(
    ({ schedule }) => schedule.scheduledDate || schedule.scheduledTime || schedule.courtId
  );
  const selectedDateMatchUps = scheduledMatchUps.filter(({ schedule }) => schedule.scheduledDate === scheduledDate);

  let options = [
    {
      option: 'Clear scheduled matches',
      disabled: !selectedDateMatchUps.length,
      onClick: clearScheduleDay
    },
    {
      option: 'Clear all matches',
      disabled: !selectedDateMatchUps.length,
      onClick: clearCompleted
    },
    {
      option: 'Clear all days',
      disabled: !scheduledMatchUps.length,
      onClick: resetSchedule
    }
  ];

  if (options.filter((o) => !o.disabled).length) {
    tipster({ target, options, config: { placement: BOTTOM } });
  }

  function resetSchedule() {
    clearScheduleDay({ all: true });
  }
  function clearCompleted() {
    clearScheduleDay({ completed: true });
  }
  function clearScheduleDay({ all, completed } = {}) {
    let filteredMatchUps = scheduledMatchUps
      .filter(({ schedule }) => schedule.scheduledDate === scheduledDate)
      .filter(({ roundName }) => !roundNameFilter || roundNameFilter === roundName)
      .filter(({ eventId }) => !eventIdFilter || eventIdFilter === eventId);

    if (completed) {
      filteredMatchUps = filteredMatchUps?.filter(
        ({ matchUpStatus, winningSide }) => matchUpStatus === 'COMPLETED' || winningSide
      );
    }

    const toBeCleared = all ? scheduledMatchUps : filteredMatchUps;
    const matchUpIds = toBeCleared.map((m) => m.matchUpId);

    const methods = [
      {
        method: BULK_SCHEDULE_MATCHUPS,
        params: {
          schedule: { courtId: '', scheduledDate: '', courtOrder: '', scheduledTime: '', venueId: '' },
          matchUpIds
        }
      }
    ];

    const postMutation = (result) => {
      if (result.success) {
        isFunction(callback) && callback();
      }
    };
    mutationRequest({ methods, callback: postMutation });
  }
}
