/**
 * Venue actions popover: edit, and take out of / return to service. A venue goes out of service on
 * every date — the factory's `disableVenues` takes no dates.
 * Shows tipster menu for venue management actions from table rows.
 */
import { editVenue, type VenueEditResult } from 'pages/tournament/tabs/venuesTab/editVenue';
import { confirmVenueOutOfService, returnVenueToService } from './courtServiceActions';
import { isVenueOutOfService } from 'functions/courtOutOfService';
import { tournamentEngine } from 'services/factory/engine';
import { tipster } from 'components/popovers/tipster';

import { BOTTOM } from 'constants/tmxConstants';
import { t } from 'i18n';

export const venueActions =
  (nestedTables: any) =>
  (e: MouseEvent, cell: any): void => {
    const tips = Array.from(document.querySelectorAll('.tippy-content'));
    if (tips.length) {
      tips.forEach((n) => n.remove());
      return;
    }
    const target = (e.target as HTMLElement).getElementsByClassName('fa-ellipsis-vertical')[0] as HTMLElement;
    const data = cell.getRow().getData();

    const row = cell.getRow();
    const venueRow = row?.getData();

    const doneEditing = ({ success, venueUpdates, courtsUpdated }: VenueEditResult) => {
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

    // Re-read the venue so the row's tag (and the next popover) reflect the new service state.
    const doneService = ({ success }: { success: boolean }) => {
      if (!success) return;
      const { venue } = tournamentEngine.findVenue({ venueId: data.venueId });
      if (venue) venueRow.venue = venue;
      row.update(venueRow);
      row.reformat();
    };

    const items = [
      {
        onClick: () => editVenue({ venue: data, callback: doneEditing }),
        text: t('tournaments.edit'),
      },
      venueServiceItem(venueRow, doneService),
    ];

    tipster({ items, target: target || (e.target as HTMLElement), config: { placement: BOTTOM } });
  };

function venueServiceItem(venueRow: any, onDone: (result: { success: boolean }) => void): any {
  const { venueId, venueName } = venueRow;
  if (isVenueOutOfService(venueRow.venue)) {
    return { text: t('courtService.returnToService'), onClick: () => returnVenueToService({ venueId, onDone }) };
  }
  return {
    text: t('courtService.takeOutOfService'),
    onClick: () =>
      confirmVenueOutOfService({
        courtIds: (venueRow.venue?.courts ?? venueRow.courts ?? []).map((court: any) => court.courtId),
        matchUps: tournamentEngine.allTournamentMatchUps().matchUps ?? [],
        venueName: venueName || venueId,
        venueId,
        onDone,
      }),
  };
}
