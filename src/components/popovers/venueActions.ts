/**
 * Venue actions popover with edit option.
 * Shows tipster menu for venue management actions from table rows.
 */
import { editVenue } from 'pages/tournament/tabs/venuesTab/editVenue';
import { tournamentEngine } from 'tods-competition-factory';
import { tipster } from 'components/popovers/tipster';

import { BOTTOM } from 'constants/tmxConstants';

export const venueActions = (nestedTables: any) => (e: MouseEvent, cell: any): void => {
  const tips = Array.from(document.querySelectorAll('.tippy-content'));
  if (tips.length) {
    tips.forEach((n) => n.remove());
    return;
  }
  const target = (e.target as HTMLElement).getElementsByClassName('fa-ellipsis-vertical')[0] as HTMLElement;
  const data = cell.getRow().getData();

  const row = cell.getRow();
  const venueRow = row?.getData();

  const doneEditing = ({ success, venueUpdates, courtsUpdated }: any) => {
    if (success) {
      Object.assign(venueRow, venueUpdates);
      row.update(venueRow);
      
      // If courts were updated, update the court rows in the nested table
      if (courtsUpdated) {
        const courtsTable = nestedTables.get(data.venueId);
        if (courtsTable) {
          // Fetch updated venue to get the new court names
          const { venue } = tournamentEngine.findVenue({ venueId: data.venueId });
          if (venue?.courts) {
            // Update each court row in the nested table
            venue.courts.forEach((court: any) => {
              courtsTable.updateData([court]);
            });
          }
        }
      }
    }
  };

  const items = [
    {
      onClick: () => editVenue({ venue: data, callback: doneEditing }),
      text: 'Edit',
    },
  ];

  tipster({ items, target: target || (e.target as HTMLElement), config: { placement: BOTTOM } });
};
