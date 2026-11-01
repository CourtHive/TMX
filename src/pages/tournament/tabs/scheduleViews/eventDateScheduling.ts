/**
 * Schedule2 — an event's playing days, as the grid and the scheduling results show them.
 *
 * The factory decides whether an event plays on a day (its range, active dates and weekdays, inside the
 * tournament's; active dates win over weekdays). Scheduling honours it in two ways, and this module turns each
 * into what TMX shows:
 *
 *  - a director's placement on a day the event does not play LANDS and is warned about, never refused:
 *    `inactivePlacements` reads a batch of grid methods BEFORE they run (so bulk and plan mode warn too) against
 *    the event's playing days, and `placementWarningMessage` says it;
 *  - the persistent marking, whoever placed the matchUp and whenever the dates changed: `eventDateIssueEntries`
 *    turns `getEventDateIssues` into the grid's issue list, at WARNING severity;
 *  - the auto-schedulers skip such matchUps and report them in `eventDateSkippedMatchUpIds`:
 *    `collectEventDateSkips` gathers them for the results drawer, and `eventDateExtensions` works out the event
 *    ranges that would take in the skipped days (only for skips whose reason is OUTSIDE_EVENT_DATES; a day
 *    removed by active dates or weekdays is the director's choice, not a range to widen).
 *
 * Pure: the engine is reached only through the resolvers the caller passes.
 */
import { t } from 'i18n';

// constants and types
import type { ScheduleIssue } from 'courthive-components';

/** the grid issue type of a matchUp on a day its event does not play (the factory warning's code) */
export const EVENT_DATE_INACTIVE = 'EVENT_DATE_INACTIVE';
export const OUTSIDE_EVENT_DATES = 'OUTSIDE_EVENT_DATES';

export type EventDateSkip = { matchUpId: string; eventId: string; reason: string };
export type EventDateSkipsByDate = { [date: string]: EventDateSkip[] };
export type EventDateIssue = {
  matchUpId: string;
  eventId: string;
  tournamentId?: string;
  scheduledDate: string;
  reason: string;
};
export type MatchUpEvent = { eventId: string; tournamentId?: string; eventName?: string };
export type InactivePlacement = MatchUpEvent & { matchUpId: string; date: string; playingDates: string[] };

const dayOf = (value?: string) => (typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : '');

/**
 * The matchUps a batch of methods would place on a date, with that date. A method counts when its
 * `params.schedule` sets a `scheduledDate` (or a `scheduledTime` with a date part); clearing a date never counts.
 * Covers `addMatchUpScheduleItems` (`matchUpId`) and `bulkScheduleMatchUps` (`matchUpIds`, `matchUpDetails`).
 */
export function placementDates(methods: any[]): { matchUpId: string; date: string }[] {
  const placements: { matchUpId: string; date: string }[] = [];
  const add = (matchUpId: any, schedule: any) => {
    const date =
      dayOf(schedule?.scheduledDate) || (schedule?.scheduledTime?.includes?.('T') ? dayOf(schedule.scheduledTime) : '');
    if (typeof matchUpId === 'string' && matchUpId && date) placements.push({ matchUpId, date });
  };
  for (const method of methods ?? []) {
    const params = method?.params ?? {};
    if (params.matchUpId) add(params.matchUpId, params.schedule);
    for (const matchUpId of params.matchUpIds ?? []) add(matchUpId, params.schedule);
    for (const detail of params.matchUpDetails ?? []) add(detail?.matchUpId, detail?.schedule ?? params.schedule);
  }
  return placements;
}

/**
 * The placements in `methods` that land on a day their event does not play. `playingDatesOf` answers the event's
 * playing days (undefined when unknown, which never warns); one entry per matchUp.
 */
export function inactivePlacements({
  methods,
  matchUpEventOf,
  playingDatesOf,
}: {
  methods: any[];
  matchUpEventOf: (matchUpId: string) => MatchUpEvent | undefined;
  playingDatesOf: (event: MatchUpEvent) => string[] | undefined;
}): InactivePlacement[] {
  const seen = new Set<string>();
  const inactive: InactivePlacement[] = [];
  const playingByEvent = new Map<string, string[] | undefined>();
  for (const { matchUpId, date } of placementDates(methods)) {
    if (seen.has(matchUpId)) continue;
    seen.add(matchUpId);
    const event = matchUpEventOf(matchUpId);
    if (!event?.eventId) continue;
    const key = `${event.tournamentId ?? ''}|${event.eventId}`;
    if (!playingByEvent.has(key)) playingByEvent.set(key, playingDatesOf(event));
    const playingDates = playingByEvent.get(key);
    if (!playingDates || playingDates.includes(date)) continue;
    inactive.push({ ...event, matchUpId, date, playingDates });
  }
  return inactive;
}

/** One warning for a batch: the first event named, and how many more matchUps share the problem. */
export function placementWarningMessage(inactive: InactivePlacement[]): string | undefined {
  if (!inactive.length) return undefined;
  const [first] = inactive;
  const event = first.eventName || first.eventId;
  const playing = first.playingDates.length ? first.playingDates.join(', ') : t('eventDates.noPlayingDays');
  const message = t('eventDates.placementWarning', { event, date: first.date, playing });
  return inactive.length > 1 ? `${message} ${t('eventDates.andMore', { count: inactive.length - 1 })}` : message;
}

/** The reason a day is not a playing day, in words. An unknown reason reads as the generic warning. */
export function eventDateReasonText(reason?: string): string {
  switch (reason) {
    case OUTSIDE_EVENT_DATES:
      return t('eventDates.reason.outsideEventDates');
    case 'OUTSIDE_TOURNAMENT_DATES':
      return t('eventDates.reason.outsideTournamentDates');
    case 'EVENT_INACTIVE_DATE':
      return t('eventDates.reason.eventInactiveDate');
    case 'EVENT_WEEKDAY':
      return t('eventDates.reason.eventWeekday');
    case 'TOURNAMENT_INACTIVE_DATE':
      return t('eventDates.reason.tournamentInactiveDate');
    case 'TOURNAMENT_WEEKDAY':
      return t('eventDates.reason.tournamentWeekday');
    default:
      return t('eventDates.reason.notPlaying');
  }
}

/** `getEventDateIssues` as grid issues, at WARNING severity (suppressible with the grid's warning toggle). */
export function eventDateIssueEntries({
  eventDateIssues,
  labelOf,
  eventNameOf,
}: {
  eventDateIssues: EventDateIssue[] | undefined;
  labelOf: (matchUpId: string) => string;
  eventNameOf: (eventId: string) => string | undefined;
}): ScheduleIssue[] {
  return (eventDateIssues ?? []).map((issue) => {
    const participants = labelOf(issue.matchUpId);
    const event = eventNameOf(issue.eventId) || issue.eventId;
    return {
      severity: 'WARN',
      issueType: EVENT_DATE_INACTIVE,
      message: t('eventDates.issue', {
        participants,
        event,
        date: issue.scheduledDate,
        reason: eventDateReasonText(issue.reason),
      }),
      participants,
      matchUpId: issue.matchUpId,
      date: issue.scheduledDate,
    };
  });
}

/** The auto-scheduler's skips, by date, with their matchUpIds; empty when nothing was skipped. */
export function collectEventDateSkips(result: any): {
  byDate: EventDateSkipsByDate;
  matchUpIds: Set<string>;
  count: number;
} {
  const byDate: EventDateSkipsByDate = {};
  const matchUpIds = new Set<string>();
  for (const [date, skips] of Object.entries(result?.eventDateSkippedMatchUpIds ?? {})) {
    const list = (Array.isArray(skips) ? skips : []).filter((skip: any) => skip?.matchUpId);
    if (!list.length) continue;
    byDate[date] = list;
    for (const skip of list) matchUpIds.add(skip.matchUpId);
  }
  return { byDate, matchUpIds, count: matchUpIds.size };
}

/**
 * The event ranges that would take in the days skipped as OUTSIDE_EVENT_DATES: each event's own range widened to
 * the earliest and latest such day. `eventOf` answers the event's current range; an event without a range of its
 * own already uses the tournament's and is left out, as is any skip with another reason.
 */
export function eventDateExtensions({
  byDate,
  eventOf,
}: {
  byDate: EventDateSkipsByDate;
  eventOf: (eventId: string) => { startDate?: string; endDate?: string } | undefined;
}): { eventId: string; startDate: string; endDate: string }[] {
  const days = new Map<string, string[]>();
  for (const [date, skips] of Object.entries(byDate)) {
    for (const skip of skips) {
      if (skip.reason !== OUTSIDE_EVENT_DATES) continue;
      days.set(skip.eventId, [...(days.get(skip.eventId) ?? []), date]);
    }
  }

  const extensions: { eventId: string; startDate: string; endDate: string }[] = [];
  for (const [eventId, dates] of days) {
    const event = eventOf(eventId);
    const startDate = dayOf(event?.startDate);
    const endDate = dayOf(event?.endDate);
    if (!startDate || !endDate) continue;
    const sorted = [...dates, startDate, endDate].sort((a, b) => a.localeCompare(b));
    const next = { eventId, startDate: sorted[0], endDate: sorted[sorted.length - 1] };
    if (next.startDate !== startDate || next.endDate !== endDate) extensions.push(next);
  }
  return extensions;
}
