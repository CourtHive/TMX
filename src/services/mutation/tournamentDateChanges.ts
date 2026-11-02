/**
 * What the factory changed, beyond the tournament's own dates, when `setTournamentDates` moved them.
 *
 * The factory keeps the rest of the record inside the new range and reports each change on its result:
 *  - `eventDateChanges`: event ranges that followed the tournament (TRACKED), were cut to it (CLAMPED) or were
 *    reset to it because they lay entirely outside (RESET);
 *  - `activeDateChanges`: active dates pruned from the tournament's list (no `eventId`) or an event's. An entry
 *    without `activeDates` means the list was emptied and UNSET, which widens that tournament or event to every day
 *    of its range. That one is a warning: the director may have meant to play only certain days;
 *  - `trimmedSchedulingProfile`: scheduling-profile dates that left with the range, in profile shape;
 *  - `unscheduledMatchUpIds`: matchUps a forced change unscheduled.
 *
 * Returns one line per change, in that order; an empty list when nothing beyond the dates changed.
 */
import { t } from 'i18n';

export type TournamentDateChangeKind = 'eventDates' | 'activeDates' | 'activeDatesUnset' | 'profile' | 'unscheduled';
export type TournamentDateChangeLine = { kind: TournamentDateChangeKind; text: string; warning: boolean };

type Args = {
  result: any;
  /** the event's display name; falls back to the eventId */
  eventName?: (eventId: string) => string | undefined;
};

const range = (startDate?: string, endDate?: string) => `${startDate ?? '?'} – ${endDate ?? '?'}`;

const EVENT_REASON_KEYS: Record<string, string> = {
  TRACKED: 'modals.tournamentDateChanges.eventTracked',
  CLAMPED: 'modals.tournamentDateChanges.eventClamped',
  RESET: 'modals.tournamentDateChanges.eventReset',
};

export function tournamentDateChangeLines({ result, eventName }: Args): TournamentDateChangeLine[] {
  if (!result || result.error) return [];
  const nameOf = (eventId: string) => eventName?.(eventId) || eventId;
  const lines: TournamentDateChangeLine[] = [];

  for (const change of result.eventDateChanges ?? []) {
    const key = EVENT_REASON_KEYS[change.reason] ?? EVENT_REASON_KEYS.CLAMPED;
    lines.push({
      kind: 'eventDates',
      warning: false,
      text: t(key, {
        event: nameOf(change.eventId),
        range: range(change.startDate, change.endDate),
        previous: range(change.previousStartDate, change.previousEndDate),
      }),
    });
  }

  for (const change of result.activeDateChanges ?? []) {
    const target = change.eventId ? nameOf(change.eventId) : t('modals.tournamentDateChanges.tournament');
    const dates = (change.prunedActiveDates ?? []).join(', ');
    const unset = !change.activeDates;
    lines.push(
      unset
        ? {
            kind: 'activeDatesUnset',
            warning: true,
            text: t('modals.tournamentDateChanges.activeDatesUnset', { target, dates }),
          }
        : {
            kind: 'activeDates',
            warning: false,
            text: t('modals.tournamentDateChanges.activeDatesPruned', { target, dates }),
          },
    );
  }

  for (const profileDate of result.trimmedSchedulingProfile ?? []) {
    const count = (profileDate.venues ?? []).reduce((sum: number, venue: any) => sum + (venue.rounds?.length ?? 0), 0);
    lines.push({
      kind: 'profile',
      warning: false,
      text: t('modals.tournamentDateChanges.profileTrimmed', { date: profileDate.scheduleDate, count }),
    });
  }

  const unscheduledCount = result.unscheduledMatchUpIds?.length ?? 0;
  if (unscheduledCount) {
    lines.push({
      kind: 'unscheduled',
      warning: false,
      text: t('modals.tournamentDateChanges.unscheduled', { count: unscheduledCount }),
    });
  }

  return lines;
}
