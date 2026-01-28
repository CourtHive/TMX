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
  booking 
}: { 
  e: Event; 
  cell: any; 
  booking: any;
}): void {
  console.log('scheduleBlockedCellMenu called', { booking });
  
  const rowData = cell.getRow().getData();
  const field = cell.getColumn().getDefinition().field;
  const cellData = rowData[field];
  console.log('Blocked cell data:', { rowData, field, cellData });
  
  const { courtId } = cellData?.schedule || {};
  const scheduledDate = context.displayed.selectedScheduleDate;
  console.log('Extracted data:', { courtId, scheduledDate });
  
  if (!courtId || !booking?.courtOrder) {
    console.warn('Missing courtId or booking.courtOrder, cannot show menu');
    return;
  }
  
  const unblockCourt = () => {
    console.log('unblockCourt called:', { courtId, scheduledDate, courtOrder: booking.courtOrder });
    
    const methods = [
      {
        method: 'removeCourtGridBooking',
        params: {
          courtId,
          scheduledDate,
          courtOrder: booking.courtOrder,  // Use original booking courtOrder
        },
      },
    ];
    
    const postMutation = (result: any) => {
      console.log('removeCourtGridBooking result:', result);
      if (result.success) {
        window.location.reload();
      } else if (result.error) {
        console.error('Failed to unblock court:', result.error);
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
