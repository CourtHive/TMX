/**
 * Schedule blocked cell menu popover.
 * Provides options for unblocking courts that have grid bookings.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tipster } from 'components/popovers/tipster';
import { context } from 'services/context';
import { RIGHT } from 'constants/tmxConstants';

export function scheduleBlockedCellMenu({
  e,
  cell,
  booking,
  updateScheduleTable,
}: {
  e: Event;
  cell: any;
  booking: any;
  updateScheduleTable?: (params: { scheduledDate: string }) => void;
}): void {
  const rowData = cell.getRow().getData();
  const field = cell.getColumn().getDefinition().field;
  const cellData = rowData[field];

  const { courtId } = cellData?.schedule || {};
  const scheduledDate = context.displayed.selectedScheduleDate;

  if (!courtId || !booking?.courtOrder) {
    return;
  }

  const unblockCourt = () => {
    const methods = [
      {
        method: 'removeCourtGridBooking',
        params: {
          courtId,
          scheduledDate,
          courtOrder: booking.courtOrder, // Use original booking courtOrder
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

  const rowText = booking.rowCount > 1 ? `${booking.rowCount} rows` : '1 row';
  const bookingLabel = booking.bookingType || 'BLOCKED';

  const options = [
    {
      option: `Unblock court (${rowText}, ${bookingLabel})`,
      onClick: unblockCourt,
    },
    booking.notes && {
      option: `Notes: ${booking.notes}`,
      disabled: true,
    },
  ].filter(Boolean);

  const target = e.target as HTMLElement;
  tipster({ options, target, config: { placement: RIGHT } });
}
