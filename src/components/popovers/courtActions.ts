/**
 * Court actions popover: edit, and take out of / return to service (every date — the venues table has
 * no selected date; the schedule grid's court header offers the dated change).
 * Shows tipster menu for court management actions from table rows.
 */
import { editCourt, type CourtEditResult } from 'pages/tournament/tabs/venuesTab/editCourt';
import { confirmCourtOutOfService, returnCourtToService } from './courtServiceActions';
import { courtServiceState } from 'functions/courtOutOfService';
import { competitionEngine } from 'services/factory/engine';
import { tipster } from 'components/popovers/tipster';

import { BOTTOM } from 'constants/tmxConstants';
import { t } from 'i18n';

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

    const doneEditing = ({ success }: CourtEditResult) => {
      if (success) {
        // Fetch updated court from venues to ensure we have correct values
        const { venues = [] } = competitionEngine.getVenuesAndCourts();
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

    // Re-read the court's service state from the engine and redraw the row's tag.
    const doneService = ({ success }: { success: boolean }) => {
      if (!success) return;
      const updated = competitionEngine.getVenuesAndCourts().courts?.find((c: any) => c.courtId === courtRow.courtId);
      courtRow.disabled = updated?.disabled;
      row.update(courtRow);
      row.reformat();
    };

    const items = [
      {
        onClick: () => editCourt({ court: courtRow, callback: doneEditing }),
        text: t('tournaments.edit'),
      },
      ...courtServiceItems(courtRow, doneService),
    ];

    tipster({ items, target: target || (e.target as HTMLElement), config: { placement: BOTTOM } });
  };

function courtServiceItems(courtRow: any, onDone: (result: { success: boolean }) => void): any[] {
  const { courtId, courtName } = courtRow;
  const { allDates, dates } = courtServiceState({ court: courtRow });
  const items: any[] = [];
  if (!allDates) {
    items.push({
      text: t('courtService.takeOutOfServiceAllDates'),
      onClick: () =>
        confirmCourtOutOfService({
          matchUps: competitionEngine.allCompetitionMatchUps().matchUps ?? [],
          courtName: courtName || courtId,
          courtId,
          onDone,
        }),
    });
  }
  if (allDates || dates.length) {
    items.push({
      text: t('courtService.returnToServiceAllDates'),
      onClick: () => returnCourtToService({ courtId, onDone }),
    });
  }
  return items;
}
