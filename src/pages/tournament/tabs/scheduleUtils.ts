/**
 * Shared schedule date utilities.
 *
 * Resolves which date to display when navigating to a schedule tab,
 * respecting tournamentRecord.activeDates when present.
 */
import { competitionEngine, tools } from 'tods-competition-factory';

/**
 * Returns the valid set of schedule dates for the tournament.
 * Uses activeDates when present; otherwise the full startDate→endDate range.
 */
export function getScheduleDateRange(): string[] {
  const { startDate, endDate } = competitionEngine.getCompetitionDateRange();
  const { tournamentInfo } = competitionEngine.getTournamentInfo();
  const activeDates: string[] | undefined = tournamentInfo?.activeDates;
  return activeDates?.length ? activeDates : tools.generateDateRange(startDate, endDate);
}

/**
 * Resolve the best date to show when navigating to a schedule tab.
 *
 * Priority:
 * 1. If today is in the valid dates → today
 * 2. Closest valid date to today (first future date, or last past date)
 */
export function resolveScheduleDate(): string {
  const dates = getScheduleDateRange();
  if (!dates.length) {
    const { startDate } = competitionEngine.getCompetitionDateRange();
    return startDate;
  }

  const today = tools.dateTime.formatDate(new Date());

  if (dates.includes(today)) return today;

  // Find closest valid date to today
  const sorted = [...dates].sort();
  const firstFuture = sorted.find((d) => d > today);
  if (firstFuture) return firstFuture;

  // All dates are in the past — return the last one
  return sorted[sorted.length - 1];
}
