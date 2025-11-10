import { mutationRequest } from 'services/mutation/mutationRequest';

import { PRO_AUTO_SCHEDULE } from 'constants/mutationConstants';
import { COMPETITION_ENGINE } from 'constants/tmxConstants';

type AutoScheduleParams = {
  updateUnscheduledTable: () => void;
  updateScheduleTable: (params: { scheduledDate: string }) => void;
  scheduledDate: string;
  table: any;
};

export function autoScheduleMatchUps({ updateUnscheduledTable, updateScheduleTable, scheduledDate, table }: AutoScheduleParams): void {
  const matchUps = table.getData('active').map((m: any) => m.matchUp);

  const methods = [
    {
      params: { matchUps, scheduledDate },
      method: PRO_AUTO_SCHEDULE,
    },
  ];
  const postMutation = (result: any) => {
    if (result.success) {
      updateUnscheduledTable();
      updateScheduleTable({ scheduledDate });
    }
  };
  mutationRequest({ methods, callback: postMutation, engine: COMPETITION_ENGINE });
}
