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
import { contactFormatter } from 'components/tables/common/formatters/contactFormatter';
import { controlBar } from 'courthive-components';
import { callSheet } from 'components/modals/callSheet';
import { buildOfficialsBoard, localCalendarDate, type OfficialRow } from 'services/officiating/officialsBoard';
import { onMutationApplied } from 'services/mutation/mutationObservers';
import { tournamentEngine } from 'tods-competition-factory';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { context } from 'services/context';
import { t } from 'i18n';

// constants and types
import { OFFICIALS_CONTROL, TOURNAMENT_OFFICIALS, RIGHT } from 'constants/tmxConstants';

const TABLE_KEY = 'officialsBoard';

let unsubscribe: (() => void) | null = null;

/**
 * Today, in the same frame every other schedule surface uses.
 *
 * Was `toISOString().slice(0, 10)`, which is **UTC**: from ~8pm in Florida it reported tomorrow, so
 * no matchUp matched the date filter and every official silently read `available`. The comment
 * claiming it was "the tournament's own frame" was simply wrong.
 */
function viewedDate(): string {
  return localCalendarDate();
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
      // D6 (mark, don't hide) lives inside contactFormatter — every contact renders, with a marker
      // on the un-consented ones. A second isPublic gate here would silently disagree with the
      // participants call sheet.
      title: t('officials.columns.contact'),
      field: 'contacts',
      formatter: contactFormatter,
      headerSort: false,
    },
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
  mountControlBar(table);

  // Every column here is derived from matchUp state, so a score or a reschedule behind this board
  // silently invalidates all of it.
  unsubscribe = onMutationApplied(() => {
    invalidateMatchUpCaches();
    context.tables[TABLE_KEY]?.replaceData(rows());
  });
}

/**
 * Call sheet over the board.
 *
 * Selection wins when there is one; otherwise the sheet covers the rows the current filters leave
 * visible. `getRows('active')` rather than `getData()` is load-bearing — `getData()` returns the
 * unfiltered set, so a director who filtered to the officials still waiting and pressed Call sheet
 * would get the whole crew. Same rule the participants sheet documents.
 *
 * The rows go through verbatim: `buildCallSheet` owns who is reachable and who is not, and
 * re-deriving personnel here is exactly the drift its header warns about.
 */
function openCallSheet(table: any): void {
  const selected = table?.getSelectedData?.() ?? [];
  const visible = (table?.getRows('active') ?? []).map((row: any) => row.getData());
  const rows = selected.length ? selected : visible;
  callSheet({ rows, subtitle: t('officials.callSheetSubtitle') });
}

function mountControlBar(table: any): void {
  const target = document.getElementById(OFFICIALS_CONTROL);
  if (!target) return;
  target.innerHTML = '';
  controlBar({
    table,
    target,
    items: [
      {
        label: t('officials.callSheet'),
        onClick: () => openCallSheet(table),
        location: RIGHT,
        id: 'officialsCallSheet',
        intent: 'none',
      },
    ],
  });
}

export function destroyOfficialsTab(): void {
  unsubscribe?.();
  unsubscribe = null;
  context.tables[TABLE_KEY]?.destroy?.();
  delete context.tables[TABLE_KEY];
}
