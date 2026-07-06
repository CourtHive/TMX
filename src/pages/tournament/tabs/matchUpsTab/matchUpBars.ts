/**
 * MatchUps-page summary bars: a mode toggle that swaps a shared segmented bar
 * between two views, both of which double as filter drivers.
 *
 *   - Competitiveness — distribution (competitive / routine / decisive / walkover)
 *     of the currently-filtered rows. Clicking a segment drives the Profile filter.
 *   - Today — the five day-of-play status buckets for matches scheduled today,
 *     scoped independently of the status filter so it stays a stable dashboard.
 *     Entering this view auto-applies the "Today" date filter; clicking a segment
 *     drives the status filter (a `today:` token) on top.
 *
 * The toggle is an icon-only control-bar button in `options_left` (beside the
 * filter icon); the bars live in `options_center`. Both views highlight the
 * active segment and stay in sync with popover-driven filter changes.
 */
import { aggregateCompetitiveness, buildCompetitivenessBar, buildSegmentedBar } from 'courthive-components';
import { BuildCompetitivenessBarResult, BuildSegmentedBarResult, CompetitivenessBucket } from 'courthive-components';
import { TODAY_STATUS_PREFIX } from 'components/tables/common/filters/matchUpStatusPredicates';
import { isoToday, TODAY_TOKEN } from 'components/tables/common/filters/matchUpDateFilter';
import { aggregateToday, getTodaySegments } from './todayView';
import { t } from 'i18n';

type FilterBridge = {
  setStatus: (status?: string) => void;
  getStatus: () => string | undefined;
  setProfile: (profile?: string) => void;
  getProfile: () => string | undefined;
  setDate: (value?: string) => void;
  getDate: () => string | undefined;
};

type MountArgs = {
  table: any;
  optionsCenter: HTMLElement;
  optionsLeft: HTMLElement;
  filters: FilterBridge;
  updateBadge: () => void;
  data: any[];
};

const BAR_FLEX = ';flex:1 1 auto;max-width:600px;';

export function mountMatchUpBars({ table, optionsCenter, optionsLeft, filters, updateBadge, data }: MountArgs): void {
  const todayIso = isoToday();
  let mode: 'competitiveness' | 'today' = 'competitiveness';

  let comp: BuildCompetitivenessBarResult;
  let today: BuildSegmentedBarResult;

  const currentTodayKey = (): string | null => {
    const status = filters.getStatus();
    return status?.startsWith(TODAY_STATUS_PREFIX) ? status.slice(TODAY_STATUS_PREFIX.length) : null;
  };

  const paintCompetitiveness = (rows: any[]): void => {
    today.element.style.display = 'none';
    comp.update(aggregateCompetitiveness(rows));
    comp.setActive((filters.getProfile() as CompetitivenessBucket) ?? null);
  };

  const paintToday = (rows: any[]): void => {
    comp.element.style.display = 'none';
    today.update(aggregateToday(rows, todayIso));
    today.setActive(currentTodayKey());
  };

  // Competitiveness reflects the filtered rows. Prefer the row set Tabulator
  // hands to `dataFiltered`; otherwise read getData('active') — reliable once
  // the table is built (toggle/click time). The initial seed paints directly
  // from `data` because getData('active') is empty mid-build (would flash off).
  // Today aggregates ALL rows scoped to today, reached only after build.
  const refresh = (filteredRows?: any[]): void => {
    if (mode === 'competitiveness') paintCompetitiveness(filteredRows ?? table.getData('active'));
    else paintToday(table.getData());
  };

  // Repaint explicitly after each click. Tabulator fires `dataFiltered` when a
  // filter is ADDED but not reliably when the last-changed filter is REMOVED, so
  // relying on the event alone leaves the active-segment dimming stuck on the
  // deselect (second) click. refresh() reads getData('active'), which respects
  // the current filters at click time, so this is correct — not a full-data paint.
  const onCompetitivenessClick = (bucket: CompetitivenessBucket): void => {
    filters.setProfile(filters.getProfile() === bucket ? undefined : bucket);
    updateBadge();
    refresh();
  };

  const onTodayClick = (key: string): void => {
    const token = `${TODAY_STATUS_PREFIX}${key}`;
    filters.setStatus(filters.getStatus() === token ? undefined : token);
    updateBadge();
    refresh();
  };

  comp = buildCompetitivenessBar({ onSegmentClick: onCompetitivenessClick });
  today = buildSegmentedBar({ segments: getTodaySegments(), onSegmentClick: onTodayClick });
  comp.element.style.cssText += BAR_FLEX;
  today.element.style.cssText += BAR_FLEX;
  today.element.style.display = 'none';
  optionsCenter.append(comp.element, today.element);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'button font-medium is-light';
  toggle.innerHTML = '<i class="fa-solid fa-arrow-right-arrow-left"></i>';

  const syncToggleTitle = (): void => {
    toggle.title = mode === 'today' ? t('pages.matchUps.showCompetitivenessView') : t('pages.matchUps.showTodayView');
  };

  toggle.onclick = () => {
    if (mode === 'competitiveness') {
      mode = 'today';
      filters.setDate(TODAY_TOKEN);
    } else {
      mode = 'competitiveness';
      // Leaving Today view clears the Today-scoped filters it applied.
      if (filters.getStatus()?.startsWith(TODAY_STATUS_PREFIX)) filters.setStatus(undefined);
      filters.setDate(undefined);
    }
    syncToggleTitle();
    updateBadge();
    refresh();
  };

  syncToggleTitle();
  optionsLeft.appendChild(toggle);

  // Keep the bar (and its active-segment highlight) synced with any filter
  // change, including popover-driven ones. `dataFiltered` hands us the filtered
  // rows directly, which is reliable even mid-build.
  table.on('dataFiltered', (_filters: any, rows: any[]) => refresh(rows));

  // Seed the first paint from the source array — the table has not built its
  // rows yet, so getData('active') would return [] and hide the bar.
  paintCompetitiveness(data);
}
