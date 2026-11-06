// Events whose own dates lie outside the tournament's, as the factory's getEventInconsistencies reports them, and
// the setEventDates that brings each one back inside. No UI imports, so it is tested through the real engine.
//
// A range that lies entirely outside (disjoint) is a stale range, left behind when the tournament moved: the
// scheduler ignores it and uses the tournament's dates ("ignore and flag", CA 2026-11-01, confirmed 2026-11-03).
// A range that only crosses an edge is clamped to the days inside the tournament. The fix makes the stored range
// say what the scheduler already does.
import { SET_EVENT_DATES } from 'constants/mutationConstants';
import { tournamentEngine } from 'services/factory/engine';
import { parseActiveDates } from './eventDates';

// getEventInconsistencies' issueType; the factory does not export the constant from its package entry
export const EVENT_DATES_OUTSIDE_TOURNAMENT = 'EVENT_DATES_OUTSIDE_TOURNAMENT';

export interface EventDatesOutsideTournament {
  tournamentStartDate: string;
  tournamentEndDate: string;
  activeDates: string[];
  startDate?: string;
  eventName?: string;
  endDate?: string;
  disjoint: boolean;
  eventId: string;
}

export function getEventsWithDatesOutsideTournament(): EventDatesOutsideTournament[] {
  const events: any[] = tournamentEngine.q.tournament()?.events ?? [];
  return events.flatMap((event) => {
    const result: any = tournamentEngine.getEventInconsistencies({ eventId: event.eventId });
    const issue = result?.inconsistencies?.find(({ issueType }: any) => issueType === EVENT_DATES_OUTSIDE_TOURNAMENT);
    if (!issue?.tournamentStartDate || !issue?.tournamentEndDate) return [];
    return [
      {
        tournamentStartDate: issue.tournamentStartDate,
        tournamentEndDate: issue.tournamentEndDate,
        activeDates: parseActiveDates(event.activeDates ?? []),
        startDate: issue.startDate,
        endDate: issue.endDate,
        disjoint: !!issue.disjoint,
        eventName: event.eventName,
        eventId: event.eventId,
      },
    ];
  });
}

/** The range the scheduler already uses: the tournament's for a disjoint range, else the event's clamped to it. */
export function fittedEventDates(issue: EventDatesOutsideTournament): { startDate: string; endDate: string } {
  const { tournamentStartDate, tournamentEndDate, startDate, endDate } = issue;
  if (issue.disjoint) return { startDate: tournamentStartDate, endDate: tournamentEndDate };
  return {
    startDate: !startDate || startDate < tournamentStartDate ? tournamentStartDate : startDate,
    endDate: !endDate || endDate > tournamentEndDate ? tournamentEndDate : endDate,
  };
}

/**
 * setEventDates with the fitted range. Active dates outside it are dropped, because setEventDates refuses any
 * active date outside the event's range; when none is left the event plays every day of its new range.
 */
export function buildFitEventDatesMethod(issue: EventDatesOutsideTournament): { method: string; params: any } {
  const { startDate, endDate } = fittedEventDates(issue);
  const activeDates = issue.activeDates.filter((date) => date >= startDate && date <= endDate);
  return { method: SET_EVENT_DATES, params: { eventId: issue.eventId, startDate, endDate, activeDates } };
}
