/**
 * Schedule empty cell menu popover.
 * Provides options for blocking courts at specific grid rows.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tipster } from 'components/popovers/tipster';
import { context } from 'services/context';
import { RIGHT } from 'constants/tmxConstants';

export function scheduleEmptyCellMenu({
  e,
  cell,
  updateScheduleTable,
}: {
  e: Event;
  cell: any;
  updateScheduleTable?: (params: { scheduledDate: string }) => void;
}): void {
  const rowData = cell.getRow().getData();
  const field = cell.getColumn().getDefinition().field;
  const cellData = rowData[field];

  const { courtId, courtOrder } = cellData?.schedule || {};

  // Only show menu if we have the necessary data
  if (!courtId || !courtOrder) {
    return;
  }

  const blockCourt = (rowCount: number, bookingType: string = 'BLOCKED') => {
    const scheduledDate = context.displayed.selectedScheduleDate;

    const methods = [
      {
        method: 'addCourtGridBooking',
        params: {
          courtId,
          scheduledDate,
          courtOrder,
          rowCount,
          bookingType,
        },
      },
    ];

    const postMutation = (result: any) => {
      // Refresh the schedule table without reloading the page
      if (result.success && updateScheduleTable && scheduledDate) {
        updateScheduleTable({ scheduledDate });
      }
    };

    mutationRequest({ methods, callback: postMutation });
  };

  const options = [
    {
      option: 'Block court (1 row)',
      onClick: () => blockCourt(1, 'BLOCKED'),
    },
    {
      option: 'Block court (2 rows)',
      onClick: () => blockCourt(2, 'BLOCKED'),
    },
    {
      option: 'Block court (3 rows)',
      onClick: () => blockCourt(3, 'BLOCKED'),
    },
    {
      option: 'Mark court for practice (1 row)',
      onClick: () => blockCourt(1, 'PRACTICE'),
    },
    {
      option: 'Mark court for maintenance (1 row)',
      onClick: () => blockCourt(1, 'MAINTENANCE'),
    },
  ].filter(Boolean);

  const target = e.target as HTMLElement;
  tipster({ options, target, config: { placement: RIGHT } });
}
