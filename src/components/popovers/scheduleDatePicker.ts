/**
 * The one way TMX asks for a matchUp's scheduled date: the tournament's dates, cut to the factory's bounds, with a
 * note naming the linked matchUp behind each cut (CA 2026-11-22).
 *
 * The matchUp menu and the matchUps table's date cell each opened `datePicker` on their own; only the menu applied the
 * bounds, so the table offered dates the write then refused with ANACHRONISM ("time violation"). Both open it here.
 */
import { dateBoundsNotes, type BoundingMatchUp, type DateBoundsNote } from './scheduleDateBoundsNote';
import { formatDateLabel } from 'components/schedule/scheduleDateSelectorLogic';
import { datesWithinBounds, type ScheduleBounds } from './matchUpMenuGates';
import { getScheduleDateRange } from 'pages/tournament/tabs/scheduleUtils';
import { tmxToast } from 'services/notifications/tmxToast';
import { tournamentEngine } from 'services/factory/engine';
import { datePicker } from 'components/modals/datePicker';
import { t } from 'i18n';

type Bounds = ScheduleBounds & { orderedBy?: BoundingMatchUp[] };

function describeMatchUp(drawId: string, matchUpId: string): string {
  const matchUp = tournamentEngine.findMatchUp({ drawId, matchUpId, inContext: true })?.matchUp;
  const sides = (matchUp?.sides ?? [])
    .map((side: any) => side?.participant?.participantName)
    .filter(Boolean)
    .join(' – ');
  return [matchUp?.roundName, sides].filter(Boolean).join(' ') || t('schedule.dateBounds.linkedMatchUp');
}

export function noteText(note: DateBoundsNote, drawId: string): string {
  return t(note.key, {
    matchUp: describeMatchUp(drawId, note.matchUpId),
    when: [formatDateLabel(note.date), note.scheduledTime].filter(Boolean).join(' '),
    date: formatDateLabel(note.date),
  });
}

export function openScheduleDatePicker({
  existingDate,
  matchUpId,
  drawId,
  onPicked,
}: {
  existingDate?: string;
  matchUpId: string;
  drawId: string;
  onPicked: (date: string) => void;
}): void {
  const dates = getScheduleDateRange();
  const bounds: Bounds | undefined = drawId
    ? tournamentEngine.getMatchUpScheduleBounds({ drawId, matchUpId })?.bounds
    : undefined;
  const activeDates = datesWithinBounds(dates, bounds);
  const notes = dateBoundsNotes({ ...bounds, dates: [...dates].sort() }).map((note) => noteText(note, drawId));

  if (!activeDates.length) {
    tmxToast({ message: [t('toasts.schedule.noValidDate'), ...notes].join(' '), intent: 'is-danger' });
    return;
  }

  datePicker({
    date: existingDate || '',
    activeDates,
    notes,
    callback: ({ date }) => {
      if (date && date !== existingDate) onPicked(date);
    },
  });
}
