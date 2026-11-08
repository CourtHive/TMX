/**
 * Today-view aggregation for the matchUps-page segmented bar.
 *
 * Buckets a set of matchUp rows scheduled for a given ISO day into the
 * day-of-play segments, using the shared classifier so the counts match what
 * clicking a segment filters to. The bar is scoped to `todayIso` and is
 * independent of the popover status filter, so it stays a stable dashboard of
 * every status while a status drill-down is active.
 */
import { TODAY_COLORS } from 'components/tables/common/filters/statusColors';
import {
  classifyTodayBucket,
  TODAY_BUCKETS,
  TodayBucket,
} from 'components/tables/common/filters/matchUpStatusPredicates';
import { SegmentDef } from 'courthive-components';
import { t } from 'i18n';

export type TodayCounts = Record<TodayBucket, number>;

// Segment colours reuse the ecosystem status tokens (both light/dark themed), shared with the status chips.
export function getTodaySegments(): SegmentDef[] {
  return [
    { key: 'complete', label: t('pages.matchUps.complete'), color: TODAY_COLORS.complete },
    { key: 'live', label: t('pages.matchUps.live'), color: TODAY_COLORS.live },
    { key: 'suspended', label: t('pages.matchUps.suspended'), color: TODAY_COLORS.suspended },
    // Called sits between suspended and ready: already sent on court, not yet started.
    { key: 'called', label: t('pages.matchUps.called'), color: TODAY_COLORS.called },
    { key: 'readyToScore', label: t('pages.matchUps.readyToScore'), color: TODAY_COLORS.readyToScore },
    { key: 'notReady', label: t('pages.matchUps.notReady'), color: TODAY_COLORS.notReady },
  ];
}

function emptyCounts(): TodayCounts {
  return { complete: 0, live: 0, suspended: 0, called: 0, readyToScore: 0, notReady: 0 };
}

/**
 * Aggregate rows (Tabulator row objects or plain data) scheduled for `todayIso`
 * into the Today buckets.
 */
export function aggregateToday(items: any[], todayIso: string): TodayCounts {
  const counts = emptyCounts();
  if (!Array.isArray(items)) return counts;
  for (const row of items) {
    const data = typeof row?.getData === 'function' ? row.getData() : row;
    if (!data || data.scheduledDate !== todayIso) continue;
    counts[classifyTodayBucket(data)] += 1;
  }
  return counts;
}

export function totalToday(counts: TodayCounts): number {
  return TODAY_BUCKETS.reduce((sum, b) => sum + counts[b], 0);
}
