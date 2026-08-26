/**
 * Court-availability window for a matchUp, used to bound the schedule time pickers.
 *
 * Extracted from `matchUpActions` so the schedule table cells can apply the same window the actions
 * popover already did. Behaviour is unchanged from the original; the debug `console.log` calls that
 * had been left in the production path were dropped in the move.
 */
import { tournamentEngine } from 'services/factory/engine';

import type { TimeBounds } from './scheduleTimeFields';

function relevantCourtsFor({ courts, courtId, venueId }: { courts: any[]; courtId?: string; venueId?: string }): any[] {
  if (courtId) return courts.filter((court: any) => court.courtId === courtId);
  if (venueId) return courts.filter((court: any) => court.venueId === venueId);
  return courts;
}

/**
 * Widest window across the courts the matchUp could be played on: its assigned court when there is
 * one, otherwise every court at its venue, otherwise every court in the tournament. Returns an empty
 * object when nothing is known, which the validators read as "unbounded".
 */
export function getCourtTimeBounds(matchUp: any): TimeBounds {
  const { courts = [] } = tournamentEngine.getVenuesAndCourts() || {};
  if (!courts.length) return {};

  const { courtId, venueId, scheduledDate } = matchUp?.schedule ?? {};
  const relevantCourts = relevantCourtsFor({ courts, courtId, venueId });
  if (!relevantCourts.length) return {};

  let earliest: string | undefined;
  let latest: string | undefined;

  for (const court of relevantCourts) {
    const dateAvail = scheduledDate ? court.dateAvailability?.find((a: any) => a.date === scheduledDate) : undefined;
    const defaultAvail = court.dateAvailability?.find((a: any) => !a.date);
    const avail = dateAvail || defaultAvail;

    if (avail?.startTime && (!earliest || avail.startTime < earliest)) earliest = avail.startTime;
    if (avail?.endTime && (!latest || avail.endTime > latest)) latest = avail.endTime;
  }

  return { earliest, latest };
}
