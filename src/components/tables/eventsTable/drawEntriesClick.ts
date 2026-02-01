/**
 * Cell click handler for 'entries' column in draws table.
 * Opens modal showing draw entries with seeding functionality.
 */
import { drawEntriesModal } from 'components/modals/drawEntriesModal';

export const drawEntriesClick =
  (eventRow: any) =>
  (_e: Event, cell: any): void => {
    const { eventId, eventName } = eventRow.getData();
    const { drawId, drawName } = cell.getRow().getData();

    // Open draw entries modal
    drawEntriesModal({
      eventName,
      eventId,
      drawName,
      drawId,
    });
  };
