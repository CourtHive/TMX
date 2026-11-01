/**
 * Schedule2 grid — the engine side of an event's playing days (the decisions live in `eventDateScheduling.ts`).
 *
 *  - `warnInactiveEventDates`: before a batch of grid methods runs, warn (never block) when a placement lands on
 *    a day its event does not play;
 *  - `eventDateGridIssues` / `eventDateIssueIds`: `getEventDateIssues`, read once per matchUp-cache generation, for
 *    the issues list and the cell decoration.
 */
import { eventDateIssueEntries, inactivePlacements, placementWarningMessage } from './eventDateScheduling';
import { getCachedAllMatchUps, getCachedMatchUpById } from './schedule2DataCache';
import { competitionEngine } from 'services/factory/engine';
import { scheduleToast } from './scheduleToast';

// constants and types
import type { ScheduleIssue } from 'courthive-components';
import type { EventDateIssue } from './eventDateScheduling';

// keyed by the matchUp cache object, which every mutation replaces, so a stale answer is never read
let issuesCache: { source: any; issues: EventDateIssue[] } | undefined;

function allEventDateIssues(): EventDateIssue[] {
  const source = getCachedAllMatchUps();
  const cached = issuesCache;
  if (cached && cached.source === source) return cached.issues;
  const result: any = competitionEngine.getEventDateIssues({});
  const issues: EventDateIssue[] = result?.eventDateIssues ?? [];
  issuesCache = { source, issues };
  return issues;
}

function matchUpLabel(matchUp: any): string {
  if (!matchUp) return 'Unknown';
  const names = (matchUp.sides || [])
    .map((side: any) => side.participant?.participantName ?? side.participantName)
    .filter(Boolean);
  return names.length ? names.join(' vs ') : matchUp.roundName || 'TBD vs TBD';
}

export function warnInactiveEventDates(methods: any[]): void {
  const byId = getCachedMatchUpById();
  const inactive = inactivePlacements({
    methods,
    matchUpEventOf: (matchUpId) => {
      const matchUp = byId.get(matchUpId);
      return matchUp && { eventId: matchUp.eventId, tournamentId: matchUp.tournamentId, eventName: matchUp.eventName };
    },
    playingDatesOf: ({ eventId, tournamentId }) => {
      const result: any = competitionEngine.getEventPlayingDates({ eventId, tournamentId });
      return result?.playingDates;
    },
  });
  const message = placementWarningMessage(inactive);
  if (message) scheduleToast({ message, intent: 'is-warning', duration: 6000, pauseOnHover: true });
}

export function eventDateGridIssues(selectedDate: string): ScheduleIssue[] {
  const eventDateIssues = allEventDateIssues().filter((issue) => issue.scheduledDate === selectedDate);
  if (!eventDateIssues.length) return [];
  const byId = getCachedMatchUpById();
  return eventDateIssueEntries({
    eventDateIssues,
    labelOf: (matchUpId) => matchUpLabel(byId.get(matchUpId)),
    eventNameOf: (eventId) => {
      const issue = eventDateIssues.find((candidate) => candidate.eventId === eventId);
      return issue && byId.get(issue.matchUpId)?.eventName;
    },
  });
}

export function eventDateIssueIds(): Set<string> {
  return new Set(allEventDateIssues().map((issue) => issue.matchUpId));
}
