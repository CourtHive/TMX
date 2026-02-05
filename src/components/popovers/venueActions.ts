/**
 * Venue actions popover with edit option.
 * Shows tipster menu for venue management actions from table rows.
 */
import { editVenue } from 'pages/tournament/tabs/venuesTab/editVenue';
import { tipster } from 'components/popovers/tipster';

import { BOTTOM } from 'constants/tmxConstants';

export const venueActions = () => (e: MouseEvent, cell: any): void => {
  const tips = Array.from(document.querySelectorAll('.tippy-content'));
  if (tips.length) {
    tips.forEach((n) => n.remove());
    return;
  }
  const target = (e.target as HTMLElement).getElementsByClassName('fa-ellipsis-vertical')[0] as HTMLElement;
  const data = cell.getRow().getData();

  const row = cell.getRow();
  const venueRow = row?.getData();

  const doneEditing = ({ success, venueUpdates }: any) => {
    if (success) {
      Object.assign(venueRow, venueUpdates);
      row.update(venueRow);
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
