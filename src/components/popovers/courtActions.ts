/**
 * Court actions popover with edit option.
 * Shows tipster menu for court management actions from table rows.
 */
import { editCourt } from 'pages/tournament/tabs/venuesTab/editCourt';
import { competitionEngine } from 'tods-competition-factory';
import { tipster } from 'components/popovers/tipster';

import { BOTTOM } from 'constants/tmxConstants';

export const courtActions =
  () =>
  (e: MouseEvent, cell: any): void => {
    const tips = Array.from(document.querySelectorAll('.tippy-content'));
    if (tips.length) {
      tips.forEach((n) => n.remove());
      return;
    }
    const target = (e.target as HTMLElement).getElementsByClassName('fa-ellipsis-vertical')[0] as HTMLElement;
    const row = cell.getRow();
    const courtRow = row?.getData();

    const doneEditing = ({ success }: any) => {
      if (success) {
        // Fetch updated court from venues to ensure we have correct values
        const { venues } = competitionEngine.getVenuesAndCourts();
        let updatedCourt: any = null;

        // Find the court in any venue
        for (const venue of venues) {
          const court = venue.courts?.find((c: any) => c.courtId === courtRow.courtId);
          if (court) {
            updatedCourt = court;
            break;
          }
        }

        if (updatedCourt) {
          // Update the row with the fresh court data
          Object.assign(courtRow, updatedCourt);
          row.update(courtRow);
        }
      }
    };

    const items = [
      {
        onClick: () => editCourt({ court: courtRow, callback: doneEditing }),
        text: 'Edit',
      },
    ];

    tipster({ items, target: target || (e.target as HTMLElement), config: { placement: BOTTOM } });
  };
