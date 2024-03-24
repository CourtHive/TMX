import { mutationRequest } from 'services/mutation/mutationRequest';

import { PRO_AUTO_SCHEDULE } from 'constants/mutationConstants';
import { COMPETITION_ENGINE } from 'constants/tmxConstants';

export function autoScheduleMatchUps({ updateUnscheduledTable, updateScheduleTable, scheduledDate, table }) {
  const matchUps = table.getData('active').map((m) => m.matchUp);

  const methods = [
    {
      params: { matchUps, scheduledDate },
      method: PRO_AUTO_SCHEDULE,
    },
  ];
  const postMutation = (result) => {
    if (result.success) {
      updateUnscheduledTable(); // faster than updating individual rows
      updateScheduleTable({ scheduledDate }); // faster than updating individual rows
    }
  };
  mutationRequest({ methods, callback: postMutation, engine: COMPETITION_ENGINE });
}
