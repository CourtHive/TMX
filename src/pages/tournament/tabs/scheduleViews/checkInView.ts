import { checkInDeskMatchUps, type DeskFilters, type CheckInFilter } from 'services/checkIn/checkInDeskModel';
import { getMatchUpCheckInState, checkInSummary } from 'services/checkIn/checkInState';
import { onMutationApplied } from 'services/mutation/mutationObservers';
import { openCheckInEditor } from 'components/checkIn/checkInEditor';
import { getCachedAllMatchUps } from './schedule2DataCache';
import { t } from 'i18n';

const ARIA_LABEL = 'aria-label';

export function renderCheckInView(container: HTMLElement, date: string) {
  const root = document.createElement('section');
  root.className = 'tmx-checkin-desk';
  root.setAttribute(ARIA_LABEL, t('checkIn.desk.title'));
  const filters: DeskFilters = { search: '', status: 'all', eventId: '', venueId: '', showCompleted: false };
  const toolbar = document.createElement('div');
  toolbar.className = 'tmx-checkin-filters';
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = t('checkIn.desk.search');
  search.setAttribute(ARIA_LABEL, t('checkIn.desk.search'));
  search.oninput = () => {
    filters.search = search.value;
    refresh();
  };
  toolbar.appendChild(search);
  const status = document.createElement('select');
  status.setAttribute(ARIA_LABEL, t('checkIn.desk.status'));
  for (const key of ['all', 'awaiting', 'partial', 'complete']) {
    status.add(new Option(t(`checkIn.desk.${key}`), key));
  }
  status.onchange = () => {
    filters.status = status.value as CheckInFilter;
    refresh();
  };
  toolbar.appendChild(status);
  const event = document.createElement('select');
  event.setAttribute(ARIA_LABEL, t('checkIn.desk.event'));
  event.onchange = () => {
    filters.eventId = event.value;
    refresh();
  };
  const venue = document.createElement('select');
  venue.setAttribute(ARIA_LABEL, t('checkIn.desk.venue'));
  venue.onchange = () => {
    filters.venueId = venue.value;
    refresh();
  };
  toolbar.append(event, venue);
  const completed = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.onchange = () => {
    filters.showCompleted = checkbox.checked;
    refresh();
  };
  completed.append(checkbox, document.createTextNode(t('checkIn.desk.showCompleted')));
  toolbar.appendChild(completed);
  const hint = document.createElement('p');
  hint.textContent = t('checkIn.desk.hint');
  const count = document.createElement('p');
  count.setAttribute('role', 'status');
  const cards = document.createElement('div');
  cards.className = 'tmx-checkin-cards';
  root.append(toolbar, hint, count, cards);
  container.appendChild(root);
  let dialog: ReturnType<typeof openCheckInEditor> | undefined;
  let disposed = false;
  let scheduled = false;

  const refresh = () => {
    if (disposed) return;
    const matchUps: any[] = getCachedAllMatchUps()?.matchUps ?? [];
    updateOptions(event, matchUps, date, 'event', filters.eventId);
    updateOptions(venue, matchUps, date, 'venue', filters.venueId);
    const visible = checkInDeskMatchUps(matchUps, date, filters);
    const activeId = (document.activeElement as HTMLElement)?.dataset.matchUpId;
    cards.replaceChildren();
    count.textContent = t('checkIn.desk.matchCount', { count: visible.length });
    if (!visible.length) cards.textContent = t('checkIn.desk.empty');
    for (const matchUp of visible) {
      const card = buildCard(matchUp);
      card.onclick = () => {
        dialog = openCheckInEditor({
          matchUpId: matchUp.matchUpId,
          drawId: matchUp.drawId,
          onClose: () => {
            if (!disposed) focusCard(cards, matchUp.matchUpId);
          },
        });
      };
      cards.appendChild(card);
    }
    if (activeId)
      [...cards.querySelectorAll<HTMLButtonElement>('button')]
        .find((card) => card.dataset.matchUpId === activeId)
        ?.focus();
  };
  const unsubscribe = onMutationApplied(() => {
    if (scheduled || disposed) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      refresh();
    });
  });
  refresh();
  return {
    refresh,
    destroy: () => {
      disposed = true;
      unsubscribe();
      dialog?.close();
      root.remove();
    },
  };
}

function updateOptions(
  select: HTMLSelectElement,
  matchUps: any[],
  date: string,
  kind: 'event' | 'venue',
  selected: string,
) {
  const entries = new Map<string, string>();
  for (const matchUp of matchUps) {
    if (matchUp.schedule?.scheduledDate !== date) continue;
    const id = kind === 'event' ? matchUp.eventId : matchUp.schedule?.venueId;
    const name = kind === 'event' ? matchUp.eventName : matchUp.schedule?.venueName;
    if (id) entries.set(id, name || id);
  }
  select.replaceChildren(new Option(t(kind === 'event' ? 'checkIn.desk.allEvents' : 'checkIn.desk.allVenues'), ''));
  for (const [id, name] of [...entries].toSorted((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }))) {
    select.add(new Option(name, id));
  }
  select.value = selected;
}

function buildCard(matchUp: any): HTMLButtonElement {
  const state = getMatchUpCheckInState(matchUp);
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'tmx-checkin-card';
  card.dataset.matchUpId = matchUp.matchUpId;
  card.dataset.checkInTone = state.allCheckedIn ? 'complete' : state.partial ? 'partial' : 'none';
  const title = document.createElement('strong');
  title.textContent = [
    matchUp.schedule?.scheduledTime || t('checkIn.desk.timeUnassigned'),
    matchUp.schedule?.courtName || t('checkIn.desk.courtUnassigned'),
  ].join(' · ');
  const subtitle = document.createElement('span');
  subtitle.textContent = [matchUp.eventName, matchUp.roundName, matchUp.schedule?.venueName]
    .filter(Boolean)
    .join(' · ');
  const badge = document.createElement('span');
  badge.className = 'tmx-checkin-desk-count';
  badge.textContent = t('checkIn.desk.checkedIn', { summary: checkInSummary(state) });
  card.append(title, subtitle, badge);
  let sideNumber: number | undefined;
  for (const participant of state.participants) {
    if (participant.sideNumber !== sideNumber) {
      sideNumber = participant.sideNumber;
      const side = document.createElement('span');
      side.className = 'tmx-checkin-side-label';
      side.textContent = t('checkIn.desk.side', { number: sideNumber });
      card.appendChild(side);
    }
    const person = document.createElement('span');
    person.textContent = `${participant.checkedIn ? '✓' : '○'} ${participant.participantName}`;
    person.setAttribute(
      'aria-label',
      `${participant.participantName}: ${t(participant.checkedIn ? 'checkIn.desk.present' : 'checkIn.desk.awaiting')}`,
    );
    card.appendChild(person);
  }
  return card;
}

function focusCard(cards: HTMLElement, matchUpId: string): void {
  [...cards.querySelectorAll<HTMLButtonElement>('button')]
    .find((button) => button.dataset.matchUpId === matchUpId)
    ?.focus();
}
