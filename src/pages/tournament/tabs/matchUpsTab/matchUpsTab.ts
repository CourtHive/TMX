/**
 * MatchUps tab with filtering and statistics.
 * Displays all tournament matches with search and popover-based filters for event, flight, team, status, and type.
 * Dynamically creates predictive accuracy buttons for all rating types present in tournament data.
 */
import { focusFirstFieldWhenRendered, isHotkeyEntryMode } from 'components/tables/matchUpsTable/hotkeyScoreField';
import { getMatchUpProfileFilter } from 'components/tables/common/filters/matchUpProfileFilter';
import { getMatchUpFlightFilter } from 'components/tables/common/filters/matchUpFlightFilter';
import { getMatchUpStatusFilter } from 'components/tables/common/filters/matchUpStatusFilter';
import { getMatchUpEventFilter } from 'components/tables/common/filters/matchUpEventFilter';
import { filterPopoverButton } from 'components/tables/common/filters/filterPopoverButton';
import { createMatchUpsTable } from 'components/tables/matchUpsTable/createMatchUpsTable';
import { getMatchUpTeamFilter } from 'components/tables/common/filters/matchUpTeamFilter';
import { getMatchUpTypeFilter } from 'components/tables/common/filters/matchUpTypeFilter';
import { getMatchUpDateFilter } from 'components/tables/common/filters/matchUpDateFilter';
import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { getActionsItem } from 'pages/tournament/tabs/matchUpsTab/abandonMatchUpsAction';
import { getBulkStatusItem } from 'pages/tournament/tabs/matchUpsTab/bulkStatusAction';
import { getPresentRatings } from 'components/tables/matchUpsTable/getPresentRatings';
import { mountMatchUpBars } from 'pages/tournament/tabs/matchUpsTab/matchUpBars';
import { preferencesConfig } from 'config/preferencesConfig';
import { tournamentEngine } from 'services/factory/engine';
import { setActiveScale } from 'settings/setActiveScale';
import { deviceConfig } from 'config/deviceConfig';
import { controlBar } from 'courthive-components';
import { context } from 'services/context';
import { t } from 'i18n';

// constants
import { LEFT, MATCHUPS_CONTROL, NONE, OVERLAY, RIGHT, TEAM_STATS } from 'constants/tmxConstants';

export function renderMatchUpTab(): void {
  const { data, table, replaceTableData } = createMatchUpsTable();
  context.refreshActiveTable = replaceTableData;
  const statsPanel = document.getElementById(TEAM_STATS)!;
  statsPanel.style.display = NONE;

  const setSearchFilter = createSearchFilter(table, { persistKey: 'search' });

  // Fetch events once and share across the event/flight/team filters
  // below. Each filter previously ran its own q.events() call, costing
  // three calls per matchUps-tab render where one suffices.
  const events = tournamentEngine.q.events() ?? [];

  const {
    eventOptions,
    hasOptions: hasEventOptions,
    isFiltered: isEventFiltered,
    activeIndex: eventActiveIndex,
  } = getMatchUpEventFilter(table, events);
  const {
    flightOptions,
    hasOptions: hasFlightOptions,
    isFiltered: isFlightFiltered,
    activeIndex: flightActiveIndex,
  } = getMatchUpFlightFilter(table, events);
  const {
    teamOptions,
    hasOptions: hasTeamOptions,
    isFiltered: isTeamFiltered,
    activeIndex: teamActiveIndex,
  } = getMatchUpTeamFilter(table, statsPanel, events);
  const {
    statusOptions,
    isFiltered: isStatusFiltered,
    activeIndex: statusActiveIndex,
    setStatus,
    getStatus,
  } = getMatchUpStatusFilter(table);
  const {
    profileOptions,
    isFiltered: isProfileFiltered,
    activeIndex: profileActiveIndex,
    setProfile,
    getProfile,
  } = getMatchUpProfileFilter(table);
  const {
    typeOptions,
    hasOptions: hasTypeOptions,
    isFiltered: isTypeFiltered,
    activeIndex: typeActiveIndex,
  } = getMatchUpTypeFilter(table, data);
  const {
    dateOptions,
    isFiltered: isDateFiltered,
    activeIndex: dateActiveIndex,
    setDate,
    getDate,
  } = getMatchUpDateFilter(table);

  const filterSections = [
    {
      label: t('pages.matchUps.allEvents'),
      options: hasEventOptions ? eventOptions : [],
      isFiltered: isEventFiltered,
      activeIndex: eventActiveIndex,
    },
    {
      label: t('pages.matchUps.allFlights'),
      options: hasFlightOptions ? flightOptions : [],
      isFiltered: isFlightFiltered,
      activeIndex: flightActiveIndex,
    },
    {
      label: t('pages.matchUps.allTeams'),
      options: hasTeamOptions ? teamOptions : [],
      isFiltered: isTeamFiltered,
      activeIndex: teamActiveIndex,
    },
    {
      label: t('pages.matchUps.allStatuses'),
      options: statusOptions,
      isFiltered: isStatusFiltered,
      activeIndex: statusActiveIndex,
    },
    {
      label: t('pages.matchUps.allProfiles'),
      options: profileOptions,
      isFiltered: isProfileFiltered,
      activeIndex: profileActiveIndex,
    },
    {
      label: t('pages.matchUps.allTypes'),
      options: hasTypeOptions ? typeOptions : [],
      isFiltered: isTypeFiltered,
      activeIndex: typeActiveIndex,
    },
    {
      label: t('pages.matchUps.allDates'),
      options: dateOptions,
      isFiltered: isDateFiltered,
      activeIndex: dateActiveIndex,
    },
  ];
  // Assigned once the bars are mounted; "Clear All" reverts the bar to competitiveness.
  let resetBarsToCompetitiveness: () => void = () => {};
  const { item: filterButton, updateBadge } = filterPopoverButton(filterSections, () => resetBarsToCompetitiveness());

  const items = [
    {
      onClick: () => table?.deselectRow(),
      label: t('pages.matchUps.schedule'),
      stateChange: true,
      location: OVERLAY,
    },
    // Weather day: one no-score status on every selected matchUp, refused whole if any row would be refused
    getBulkStatusItem(table, replaceTableData),
    {
      onKeyDown: (e: any) => e.keyCode === 8 && e.target.value.length === 1 && setSearchFilter(''),
      onChange: (e: any) => setSearchFilter(e.target.value),
      onKeyUp: (e: any) => setSearchFilter(e.target.value),
      clearSearch: () => setSearchFilter(''),
      placeholder: t('pages.matchUps.searchMatches'),
      value: context.matchUpFilters.search || '',
      location: LEFT,
      search: true,
    },
    filterButton,
    // Dynamically create predictive accuracy buttons for all rating types present in tournament
    ...getPredictiveAccuracyItems(replaceTableData),
    // Hotkey score entry: just left of [Actions]
    getHotkeyEntryToggle(replaceTableData),
    // End-of-tournament actions menu (only present on/past the last date)
    getActionsItem(replaceTableData),
  ].filter(Boolean);

  const target = document.getElementById(MATCHUPS_CONTROL)!;
  controlBar({ table, target, items });

  // Re-apply the filter-active class once the freshly-mounted button is in
  // the DOM. Without this, returning to the tab with persisted filters loses
  // the orange pulse (the inline label HTML doesn't carry the class).
  // See renderIndividuals for the participants-tab equivalent.
  updateBadge();

  const optionsCenter = target.getElementsByClassName('options_center')[0] as HTMLElement | undefined;
  const optionsLeft = target.getElementsByClassName('options_left')[0] as HTMLElement | undefined;
  if (optionsCenter && optionsLeft) {
    const bars = mountMatchUpBars({
      table,
      optionsCenter,
      optionsLeft,
      updateBadge,
      data,
      filters: { setStatus, getStatus, setProfile, getProfile, setDate, getDate },
    });
    resetBarsToCompetitiveness = bars.resetToCompetitiveness;
  }
}

const HOTKEY_TOGGLE = 'hotkeyScoringToggle';
const hotkeyIcon = (on: boolean) =>
  on
    ? '<i class="fa-solid fa-table-tennis-paddle-ball" style="color: var(--tmx-accent-blue)"></i>'
    : '<i class="fa-solid fa-table-tennis-paddle-ball"></i>';

/**
 * Hotkey score entry (CA, 2026-10-12): the inline-scoring icon, just left of [Actions]. On, every matchUp ready to
 * score is an entry field; Tab moves between them and Enter saves and moves to the next. Not offered on mobile,
 * where the keypad is never used.
 */
function getHotkeyEntryToggle(replaceTableData: () => void): any | null {
  if (deviceConfig.get().isMobile) return null;
  return {
    id: HOTKEY_TOGGLE,
    label: hotkeyIcon(isHotkeyEntryMode()),
    toolTip: { content: t('pages.matchUps.hotkeyScoring'), placement: 'bottom' },
    location: RIGHT,
    onClick: () => {
      const on = !isHotkeyEntryMode();
      preferencesConfig.set({ hotkeys: on });
      const toggle = document.getElementById(HOTKEY_TOGGLE);
      if (toggle) toggle.innerHTML = hotkeyIcon(on);
      replaceTableData();
      // The fields exist only once the table has redrawn
      if (on) focusFirstFieldWhenRendered();
    },
  };
}

const intentColors = ['is-danger', 'is-info', 'is-success', 'is-warning', 'is-link', 'is-primary'];

function getPredictiveAccuracyItems(replaceTableData: () => void): any[] {
  const presentRatings = getPresentRatings();

  let colorIndex = 0;
  return Array.from(presentRatings).map((scaleName) => ({
    onClick: () => {
      setActiveScale(scaleName.toLowerCase());
      replaceTableData();
    },
    id: `${scaleName.toLowerCase()}PredictiveAccuracy`,
    intent: intentColors[colorIndex++ % intentColors.length],
    location: RIGHT,
    text: `${scaleName} %`,
    hide: true,
  }));
}
