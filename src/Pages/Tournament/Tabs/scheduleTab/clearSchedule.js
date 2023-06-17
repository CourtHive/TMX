import { mutationRequest } from 'services/mutation/mutationRequest';
import { competitionEngine } from 'tods-competition-factory';
import { isFunction } from 'functions/typeOf';
import { tipster } from 'components/popovers/tipster';

import { BULK_SCHEDULE_MATCHUPS } from 'constants/mutationConstants';
import { BOTTOM } from 'constants/tmxConstants';

export function clearSchedule({ scheduledDate, target, callback }) {
  const result = competitionEngine.competitionScheduleMatchUps({ courtCompletedMatchUps: true });
  const { dateMatchUps = [], completedMatchUps = [] } = result;
  const matchUps = dateMatchUps.concat(...completedMatchUps);
  const scheduledMatchUps = matchUps.filter(
    ({ schedule }) => schedule.scheduledDate || schedule.scheduledTime || schedule.courtId
  );
  const selectedDateMatchUps = scheduledMatchUps.filter(({ schedule }) => schedule.scheduledDate === scheduledDate);

  let options = [
    {
      option: 'clear scheduled matches',
      disabled: !selectedDateMatchUps.length,
      onClick: clearScheduleDay
    },
    {
      option: 'clear all matches',
      disabled: !selectedDateMatchUps.length,
      onClick: clearCompleted
    },
    {
      option: 'clear all days',
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
    if (completed) {
      //
    }
    const filtered_matches = scheduledMatchUps;
    /*
    let euid = container.event_filter.ddlb.getValue();
    let round_filter = container.round_filter.ddlb.getValue();

    // first filter for matches on selected day, and include completed if flagged
    // additionally filter by selected event and round
    let filtered_matches = scheduled
      .filter((s) => s.schedule.day === context.displayed.schedule_day && (completed || s.winner === undefined))
      .filter((m) => (!euid || euid === m.event.euid) && (!round_filter || round_filter === m.round_name));
      */

    const toBeCleared = all ? scheduledMatchUps : filtered_matches;
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
        // reset all filters
      }
    };
    mutationRequest({ methods, callback: postMutation });

    // TODO: if authorized send array of matches as mutation to live site
    if (isFunction(callback)) callback();
  }
}
