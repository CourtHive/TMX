import { createChipSelection, paintChipColor } from 'components/tables/common/filters/chipFilter';
import { filterPopoverButton } from 'components/tables/common/filters/filterPopoverButton';
import { STATUS_BUCKETS } from 'components/tables/common/filters/matchUpStatusPredicates';
import { getMatchUpCheckInState, checkInSummary } from 'services/checkIn/checkInState';
import { STATUS_BUCKET_COLORS } from 'components/tables/common/filters/statusColors';
import { genderAccent } from 'components/tables/common/formatters/genderAccent';
import { onMutationApplied } from 'services/mutation/mutationObservers';
import { openCheckInEditor } from 'components/checkIn/checkInEditor';
import { recoverIfSafe } from 'services/messaging/remoteMutations';
import { getCachedAllMatchUps } from './schedule2DataCache';
import { controlBar } from 'courthive-components';
import { LEFT } from 'constants/tmxConstants';
import { t } from 'i18n';
import {
  checkInDeskMatchUps,
  deskBucketCounts,
  participantSexes,
  DEFAULT_DESK_BUCKETS,
  type DeskFilters,
} from 'services/checkIn/checkInDeskModel';

const ARIA_LABEL = 'aria-label';
const CHECK_IN_STATES = ['all', 'awaiting', 'partial', 'complete'] as const;

const BUCKET_LABELS: Record<string, string> = {
  toBePlayed: 'pages.matchUps.toBePlayed',
  live: 'pages.matchUps.live',
  suspended: 'pages.matchUps.suspended',
  complete: 'pages.matchUps.complete',
};

type DropdownOption = { label: string; value: string; onClick: () => void; close: true };

export function renderCheckInView(container: HTMLElement, date: string) {
  const root = document.createElement('section');
  root.className = 'tmx-checkin-desk';
  root.setAttribute(ARIA_LABEL, t('checkIn.desk.title'));
  const filters: DeskFilters = { search: '', status: 'all', eventId: '', venueId: '', buckets: DEFAULT_DESK_BUCKETS };

  // The filter popover reads these when it opens, so a refresh keeps them current in place.
  const eventOptions: DropdownOption[] = [];
  const venueOptions: DropdownOption[] = [];
  const stateOptions: DropdownOption[] = CHECK_IN_STATES.map((value) => ({
    label: t(`checkIn.desk.${value}`),
    value,
    onClick: () => {
      filters.status = value;
      refresh();
    },
    close: true,
  }));
  const indexOf = (options: DropdownOption[], value: string) =>
    Math.max(
      options.findIndex((option) => option.value === value),
      0,
    );
  const syncOptions = (matchUps: any[]) => {
    updateOptions(eventOptions, matchUps, date, 'event', (eventId) => {
      filters.eventId = eventId;
      refresh();
    });
    updateOptions(venueOptions, matchUps, date, 'venue', (venueId) => {
      filters.venueId = venueId;
      refresh();
    });
  };
  // filterPopoverButton drops a section that has no options when it is made, so they are filled first
  syncOptions(getCachedAllMatchUps()?.matchUps ?? []);
  const { item: filterButton, updateBadge } = filterPopoverButton([
    {
      label: t('checkIn.desk.status'),
      options: stateOptions,
      isFiltered: () => filters.status !== 'all',
      activeIndex: () => indexOf(stateOptions, filters.status),
    },
    {
      label: t('checkIn.desk.allEvents'),
      options: eventOptions,
      isFiltered: () => !!filters.eventId,
      activeIndex: () => indexOf(eventOptions, filters.eventId),
    },
    {
      label: t('checkIn.desk.allVenues'),
      options: venueOptions,
      isFiltered: () => !!filters.venueId,
      activeIndex: () => indexOf(venueOptions, filters.venueId),
    },
  ]);
  const setSearch = (value: string) => {
    if (filters.search === value) return;
    filters.search = value;
    refresh();
  };
  const toolbar = document.createElement('div');
  toolbar.className = 'tmx-checkin-filters';
  root.appendChild(toolbar);
  container.appendChild(root);
  controlBar({
    target: toolbar,
    items: [
      {
        onChange: (e: any) => setSearch(e.target.value),
        onKeyUp: (e: any) => setSearch(e.target.value),
        clearSearch: () => setSearch(''),
        placeholder: t('checkIn.desk.search'),
        location: LEFT,
        search: true,
      },
      filterButton,
    ],
  });

  // The matchUps table's status chips, on the same buckets and colours, with the same toggle rules (chipFilter.ts).
  const chips = document.createElement('div');
  chips.className = 'tmx-status-strip tmx-checkin-status-chips';
  chips.setAttribute('role', 'group');
  chips.setAttribute(ARIA_LABEL, t('checkIn.desk.statusChips'));
  const selection = createChipSelection({
    values: [...STATUS_BUCKETS],
    initial: DEFAULT_DESK_BUCKETS,
    persist: (selected) => (filters.buckets = selected),
    onChange: () => refresh(),
  });
  const chipButtons = STATUS_BUCKETS.map((value) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-popover-chip tmx-status-strip-chip font-medium';
    chip.dataset.value = value;
    paintChipColor(chip, STATUS_BUCKET_COLORS[value]);
    const name = document.createElement('span');
    name.textContent = t(BUCKET_LABELS[value]);
    const tally = document.createElement('span');
    tally.className = 'tmx-status-strip-count';
    chip.append(name, tally);
    chip.onclick = () => selection.toggle(value);
    return chip;
  });
  chips.append(...chipButtons);

  const hint = document.createElement('p');
  hint.textContent = t('checkIn.desk.hint');
  const count = document.createElement('p');
  count.setAttribute('role', 'status');
  const cards = document.createElement('div');
  cards.className = 'tmx-checkin-cards';
  root.append(chips, hint, count, cards);
  let dialog: ReturnType<typeof openCheckInEditor> | undefined;
  let disposed = false;
  let scheduled = false;

  const refresh = () => {
    if (disposed) return;
    const matchUps: any[] = getCachedAllMatchUps()?.matchUps ?? [];
    syncOptions(matchUps);
    updateBadge();
    const tallies = deskBucketCounts(matchUps, date, filters);
    for (const chip of chipButtons) {
      const value = chip.dataset.value as (typeof STATUS_BUCKETS)[number];
      const on = selection.isOn(value);
      chip.setAttribute('aria-pressed', String(on));
      chip.dataset.on = String(on);
      (chip.lastElementChild as HTMLElement).textContent = String(tallies[value]);
    }
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
          // A refresh that waited for this editor can run now.
          onSettled: recoverIfSafe,
          onClose: () => {
            if (!disposed) focusCard(cards, matchUp.matchUpId);
            recoverIfSafe();
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
    /** Whether an open editor holds a pending request or attester entry (see authoritativeRecovery.ts). */
    isBusy: () => !disposed && !!dialog?.isBusy(),
    destroy: () => {
      disposed = true;
      unsubscribe();
      dialog?.close();
      root.remove();
    },
  };
}

function updateOptions(
  options: DropdownOption[],
  matchUps: any[],
  date: string,
  kind: 'event' | 'venue',
  select: (id: string) => void,
) {
  const entries = new Map<string, string>();
  for (const matchUp of matchUps) {
    if (matchUp.schedule?.scheduledDate !== date) continue;
    const id = kind === 'event' ? matchUp.eventId : matchUp.schedule?.venueId;
    const name = kind === 'event' ? matchUp.eventName : matchUp.schedule?.venueName;
    if (id) entries.set(id, name || id);
  }
  const option = (label: string, value: string): DropdownOption => ({
    label,
    value,
    onClick: () => select(value),
    close: true,
  });
  const sorted = [...entries].toSorted((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }));
  options.splice(
    0,
    options.length,
    option(t(kind === 'event' ? 'checkIn.desk.allEvents' : 'checkIn.desk.allVenues'), ''),
    ...sorted.map(([id, name]) => option(name, id)),
  );
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
  const eventName = document.createElement('span');
  eventName.className = 'tmx-checkin-event';
  eventName.textContent = matchUp.eventName ?? '';
  eventName.style.color = genderAccent(matchUp.gender);
  const detail = [matchUp.roundName, matchUp.schedule?.venueName].filter(Boolean).join(' · ');
  subtitle.appendChild(eventName);
  if (detail) subtitle.append(`${matchUp.eventName ? ' · ' : ''}${detail}`);
  const badge = document.createElement('span');
  badge.className = 'tmx-checkin-desk-count';
  badge.textContent = t('checkIn.desk.checkedIn', { summary: checkInSummary(state) });
  card.append(title, subtitle, badge);
  const sexes = participantSexes(matchUp);
  let sideNumber: number | undefined;
  for (const participant of state.participants) {
    const person = document.createElement('span');
    person.className = 'tmx-checkin-person-line';
    person.dataset.checkedIn = String(participant.checkedIn);
    // [○ Side 1: Name]: the mark leads, the state a desk scans for (CA 11-15). The side is named once, on its first
    // member's line; a partner's line keeps the column so names align.
    const side = document.createElement('span');
    side.className = 'tmx-checkin-side-label';
    if (participant.sideNumber !== sideNumber) {
      sideNumber = participant.sideNumber;
      side.textContent = t('checkIn.desk.side', { number: sideNumber });
    }
    const mark = document.createElement('span');
    mark.className = 'tmx-checkin-mark';
    mark.textContent = participant.checkedIn ? '✓' : '○';
    const name = document.createElement('span');
    name.textContent = participant.participantName;
    name.style.color = genderAccent(sexes.get(participant.participantId));
    person.append(mark, side, name);
    person.setAttribute(
      ARIA_LABEL,
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
