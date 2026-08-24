/**
 * Officials board — P0 of TMX_OFFICIALS_COORDINATION.
 *
 * Read-only, zero schema change, no AMS registry and no declarations service. Answers the question a
 * referee coordinating a crew actually asks: *who is on which court right now, who is free, and who
 * has been working since 9am?*
 *
 * All decision logic lives in the pure `services/officiating/officialsBoard` module — TMX has no
 * jsdom, so anything decided in here gets no unit coverage. This file is a thin shell: fetch, derive,
 * paint.
 *
 * **Subscribes to `onMutationApplied`.** Every value on this board is derived from matchUp state, so
 * without the subscription the board goes stale the moment anyone scores or reschedules behind it.
 */

import { getCachedAllMatchUps, invalidateMatchUpCaches } from 'pages/tournament/tabs/scheduleViews/schedule2DataCache';
import { buildOfficialsBoard, type OfficialRow } from 'services/officiating/officialsBoard';
import { onMutationApplied } from 'services/mutation/mutationObservers';
import { tournamentEngine } from 'tods-competition-factory';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { context } from 'services/context';
import { t } from 'i18n';

// constants and types
import { TOURNAMENT_OFFICIALS } from 'constants/tmxConstants';

const TABLE_KEY = 'officialsBoard';

let unsubscribe: (() => void) | null = null;

/** Today in the tournament's own frame, matching how the schedule surfaces date-scope. */
function viewedDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function rows(): OfficialRow[] {
  const { matchUps } = getCachedAllMatchUps() ?? {};
  // `timeItems` ride along by default — verified empirically, and load-bearing: `signedInOnDate`
  // reads the SIGN_IN_STATUS history rather than the `signedIn` flag, which is the latest value and
  // stays true all week because nothing signs anybody out.
  const { participants } =
    tournamentEngine.getParticipants({ participantFilters: { participantRoles: ['OFFICIAL'] } }) ?? {};

  return buildOfficialsBoard({
    matchUps: matchUps ?? [],
    participants: participants ?? [],
    date: viewedDate(),
  });
}

/** Colour carries the state so the board is scannable; the label carries the meaning. */
function stateFormatter(cell: any): HTMLElement {
  const state = cell.getValue();
  const span = document.createElement('span');
  span.className = `tmx-official-state is-${state}`;
  span.dataset.officialState = state;
  span.textContent = t(`officials.state.${state}`);
  if (state === 'available') span.title = t('officials.state.availableHint');
  return span;
}

function minutesFormatter(cell: any): string {
  const minutes = cell.getValue() ?? 0;
  if (!minutes) return '';
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

function columns(): any[] {
  return [
    { title: t('officials.columns.name'), field: 'participantName', widthGrow: 2, headerSort: true },
    { title: t('officials.columns.state'), field: 'state', formatter: stateFormatter, headerSort: true },
    { title: t('officials.columns.court'), field: 'courtName', headerSort: true },
    { title: t('officials.columns.next'), field: 'nextScheduledTime', hozAlign: 'center', headerSort: true },
    { title: t('officials.columns.matches'), field: 'matchesToday', hozAlign: 'center', headerSort: true },
    {
      title: t('officials.columns.onCourt'),
      field: 'minutesOnCourtToday',
      hozAlign: 'center',
      formatter: minutesFormatter,
      headerSort: true,
    },
  ];
}

export function renderOfficialsTab(): void {
  const element = document.getElementById(TOURNAMENT_OFFICIALS);
  if (!element) return;

  destroyOfficialsTab();
  element.innerHTML = '';

  // Pre-sorted by buildOfficialsBoard (house rule: never hand Tabulator an unsorted array and
  // expect initialSort to do it).
  const table = new Tabulator(element, {
    data: rows(),
    columns: columns(),
    layout: 'fitColumns',
    placeholder: t('officials.empty'),
    height: '100%',
  });

  context.tables[TABLE_KEY] = table;

  // Every column here is derived from matchUp state, so a score or a reschedule behind this board
  // silently invalidates all of it.
  unsubscribe = onMutationApplied(() => {
    invalidateMatchUpCaches();
    context.tables[TABLE_KEY]?.replaceData(rows());
  });
}

export function destroyOfficialsTab(): void {
  unsubscribe?.();
  unsubscribe = null;
  context.tables[TABLE_KEY]?.destroy?.();
  delete context.tables[TABLE_KEY];
}
