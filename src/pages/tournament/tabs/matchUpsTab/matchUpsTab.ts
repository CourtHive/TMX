/**
 * MatchUps tab with filtering and statistics.
 * Displays all tournament matches with search and popover-based filters for event, flight, team, status, and type.
 * Dynamically creates predictive accuracy buttons for all rating types present in tournament data.
 */
import { getMatchUpFlightFilter } from 'components/tables/common/filters/matchUpFlightFilter';
import { getMatchUpStatusFilter } from 'components/tables/common/filters/matchUpStatusFilter';
import { getMatchUpEventFilter } from 'components/tables/common/filters/matchUpEventFilter';
import { filterPopoverButton } from 'components/tables/common/filters/filterPopoverButton';
import { createMatchUpsTable } from 'components/tables/matchUpsTable/createMatchUpsTable';
import { getMatchUpTeamFilter } from 'components/tables/common/filters/matchUpTeamFilter';
import { getMatchUpTypeFilter } from 'components/tables/common/filters/matchUpTypeFilter';
import { getMatchUpDateFilter } from 'components/tables/common/filters/matchUpDateFilter';
import { aggregateCompetitiveness, buildCompetitivenessBar } from 'courthive-components';
import { createSearchFilter } from 'components/tables/common/filters/createSearchFilter';
import { getPresentRatings } from 'components/tables/matchUpsTable/getPresentRatings';
import { getActionsItem } from 'pages/tournament/tabs/matchUpsTab/abandonMatchUpsAction';
import { tournamentEngine } from 'services/factory/engine';
import { setActiveScale } from 'settings/setActiveScale';
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

  const { eventOptions, hasOptions: hasEventOptions, isFiltered: isEventFiltered, activeIndex: eventActiveIndex } = getMatchUpEventFilter(table, events);
  const { flightOptions, hasOptions: hasFlightOptions, isFiltered: isFlightFiltered, activeIndex: flightActiveIndex } = getMatchUpFlightFilter(table, events);
  const { teamOptions, hasOptions: hasTeamOptions, isFiltered: isTeamFiltered, activeIndex: teamActiveIndex } = getMatchUpTeamFilter(table, statsPanel, events);
  const { statusOptions, isFiltered: isStatusFiltered, activeIndex: statusActiveIndex } = getMatchUpStatusFilter(table);
  const { typeOptions, hasOptions: hasTypeOptions, isFiltered: isTypeFiltered, activeIndex: typeActiveIndex } = getMatchUpTypeFilter(table, data);
  const { dateOptions, isFiltered: isDateFiltered, activeIndex: dateActiveIndex } = getMatchUpDateFilter(table);

  const filterSections = [
    { label: t('pages.matchUps.allEvents'), options: hasEventOptions ? eventOptions : [], isFiltered: isEventFiltered, activeIndex: eventActiveIndex },
    { label: t('pages.matchUps.allFlights'), options: hasFlightOptions ? flightOptions : [], isFiltered: isFlightFiltered, activeIndex: flightActiveIndex },
    { label: t('pages.matchUps.allTeams'), options: hasTeamOptions ? teamOptions : [], isFiltered: isTeamFiltered, activeIndex: teamActiveIndex },
    { label: t('pages.matchUps.allStatuses'), options: statusOptions, isFiltered: isStatusFiltered, activeIndex: statusActiveIndex },
    { label: t('pages.matchUps.allTypes'), options: hasTypeOptions ? typeOptions : [], isFiltered: isTypeFiltered, activeIndex: typeActiveIndex },
    { label: t('pages.matchUps.allDates'), options: dateOptions, isFiltered: isDateFiltered, activeIndex: dateActiveIndex },
  ];
  const { item: filterButton, updateBadge } = filterPopoverButton(filterSections);

  const items = [
    {
      onClick: () => table?.deselectRow(),
      label: t('pages.matchUps.schedule'),
      stateChange: true,
      location: OVERLAY,
    },
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
  if (optionsCenter) {
    const { element: summary, update: updateBar } = buildCompetitivenessBar();
    // Keep the flex sizing that the old summary used inside options_center.
    summary.style.cssText += ';flex:1 1 auto;max-width:600px;';
    optionsCenter.appendChild(summary);
    updateBar(aggregateCompetitiveness(data));
    table.on('dataFiltered', (_filters: any, rows: any[]) => updateBar(aggregateCompetitiveness(rows)));
  }
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
