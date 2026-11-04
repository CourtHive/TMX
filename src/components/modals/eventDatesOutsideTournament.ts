/**
 * Lists the events whose dates lie outside the tournament's (getEventInconsistencies) and offers, per event, the
 * setEventDates that brings its dates back inside. Scheduling already ignores a disjoint range and clamps one that
 * crosses an edge, so the fix changes no schedule: it makes the stored dates say what the scheduler does.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { closeModal, openModal } from './baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { providerConfig } from 'config/providerConfig';
import { t } from 'i18n';
import {
  buildFitEventDatesMethod,
  fittedEventDates,
  type EventDatesOutsideTournament,
} from 'pages/tournament/tabs/eventsTab/eventDatesOutsideTournament';

const range = (startDate?: string, endDate?: string) => `${startDate ?? '?'} – ${endDate ?? '?'}`;

function issueRow(issue: EventDatesOutsideTournament, onFixed: () => void): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = 'padding: .5em 0; border-bottom: 1px solid var(--tmx-border-primary);';

  const name = document.createElement('div');
  name.style.cssText = 'font-weight: 600; color: var(--tmx-text-primary);';
  name.textContent = issue.eventName ?? issue.eventId;

  const message = document.createElement('div');
  message.style.cssText = 'margin: .25em 0 .5em; color: var(--tmx-text-secondary);';
  message.textContent = t(
    issue.disjoint ? 'eventDates.outsideTournament.disjoint' : 'eventDates.outsideTournament.edge',
    {
      event: range(issue.startDate, issue.endDate),
      tournament: range(issue.tournamentStartDate, issue.tournamentEndDate),
    },
  );
  row.append(name, message);

  if (providerConfig.isAllowed('canModifyEventFormat')) {
    const fitted = fittedEventDates(issue);
    const button = document.createElement('button');
    button.className = 'button is-small is-warning';
    button.textContent = t(
      issue.disjoint ? 'eventDates.outsideTournament.setToTournament' : 'eventDates.outsideTournament.trim',
      {
        range: range(fitted.startDate, fitted.endDate),
      },
    );
    button.addEventListener('click', () => {
      button.disabled = true;
      mutationRequest({
        methods: [buildFitEventDatesMethod(issue)],
        callback: (result: any) => {
          if (!result?.success) {
            button.disabled = false;
            tmxToast({ message: t('eventDates.outsideTournament.failed'), intent: 'is-danger' });
            return;
          }
          tmxToast({ message: t('eventDates.outsideTournament.fixed'), intent: 'is-success' });
          row.remove();
          onFixed();
        },
      });
    });
    row.appendChild(button);
  }

  return row;
}

export function openEventDatesOutsideTournamentModal({
  issues,
  onFixed,
}: {
  issues: EventDatesOutsideTournament[];
  onFixed: () => void;
}): void {
  const content = document.createElement('div');
  content.style.cssText = 'color: var(--tmx-text-primary);';

  const intro = document.createElement('p');
  intro.style.cssText = 'margin-bottom: .5em;';
  intro.textContent = t('eventDates.outsideTournament.intro');
  content.appendChild(intro);

  let remaining = issues.length;
  const fixed = () => {
    remaining -= 1;
    if (!remaining) closeModal();
    onFixed();
  };
  for (const issue of issues) content.appendChild(issueRow(issue, fixed));

  openModal({
    title: t('eventDates.outsideTournament.title'),
    content,
    buttons: [{ label: t('ui.ok'), close: true }],
  });
}
