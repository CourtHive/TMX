/**
 * After a tournament date change: tell the director what else the factory changed to keep the record inside the
 * new dates (event ranges, active dates, scheduling-profile dates, unscheduled matchUps). An active-date list that
 * was emptied and unset is shown as a warning, since that event or the tournament now plays every day.
 * Nothing is shown when nothing beyond the dates changed. The lines come from `tournamentDateChangeLines`.
 */
import { tournamentDateChangeLines } from 'services/mutation/tournamentDateChanges';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

type Args = {
  /** the `setTournamentDates` method result (`results[n]` of the mutation) */
  result: any;
  /** the tournament's events, to name them; an event not found is named by its eventId */
  events?: { eventId: string; eventName?: string }[];
};

export function showTournamentDateChanges({ result, events }: Args): void {
  const names = new Map((events ?? []).map((event) => [event.eventId, event.eventName]));
  const lines = tournamentDateChangeLines({ result, eventName: (eventId) => names.get(eventId) });
  if (!lines.length) return;

  const content = document.createElement('ul');
  content.style.cssText = 'margin: 0; padding-left: 1.2em; display: flex; flex-direction: column; gap: 6px;';
  for (const line of lines) {
    const item = document.createElement('li');
    item.textContent = line.text;
    if (line.warning) {
      item.style.cssText =
        'color: var(--tmx-status-warning); background: var(--tmx-container-warning); ' +
        'padding: 4px 6px; border-radius: 4px; font-weight: 600;';
    }
    content.appendChild(item);
  }

  openModal({
    title: t('modals.tournamentDateChanges.title'),
    content,
    buttons: [{ label: t('common.ok'), intent: 'is-primary', close: true }],
  });
}
