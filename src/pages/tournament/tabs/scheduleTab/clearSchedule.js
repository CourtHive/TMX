import { mutationRequest } from 'services/mutation/mutationRequest';
import { competitionEngine } from 'tods-competition-factory';
import { tipster } from 'components/popovers/tipster';
import { isFunction } from 'functions/typeOf';

// constants
import { BULK_SCHEDULE_MATCHUPS } from 'constants/mutationConstants';
import { BOTTOM } from 'constants/tmxConstants';

export function clearSchedule({ scheduledDate, target, roundNameFilter, eventIdFilter, callback }) {
  const result = competitionEngine.competitionScheduleMatchUps({ courtCompletedMatchUps: true });
  const { dateMatchUps = [], completedMatchUps = [] } = result;
  const matchUps = dateMatchUps.concat(...completedMatchUps);
  const scheduledMatchUps = matchUps.filter(
    ({ schedule }) => schedule.scheduledDate || schedule.scheduledTime || schedule.courtId,
  );
  const selectedDateMatchUps = scheduledMatchUps.filter(({ schedule }) => schedule.scheduledDate === scheduledDate);

  let options = [
    {
      disabled: !selectedDateMatchUps.length,
      option: 'Clear scheduled matches',
      onClick: clearScheduleDay,
    },
    {
      disabled: !selectedDateMatchUps.length,
      option: 'Clear all matches',
      onClick: clearCompleted,
    },
    {
      disabled: !scheduledMatchUps.length,
      option: 'Clear all days',
      onClick: resetSchedule,
    },
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

    if (!completed) {
      filteredMatchUps = filteredMatchUps?.filter(
        ({ matchUpStatus, winningSide }) => matchUpStatus !== 'COMPLETED' && !winningSide,
      );
    }

    const toBeCleared = all ? scheduledMatchUps : filteredMatchUps;
    const matchUpIds = toBeCleared.map((m) => m.matchUpId);

    const methods = [
      {
        method: BULK_SCHEDULE_MATCHUPS,
        params: {
          schedule: { courtId: '', scheduledDate: '', courtOrder: '', scheduledTime: '', venueId: '' },
          removePriorValues: true,
          matchUpIds,
        },
      },
    ];

    const postMutation = (result) => {
      if (result.success) {
        if (isFunction(callback)) callback();
      }
    };
    mutationRequest({ methods, callback: postMutation });
  }
}
