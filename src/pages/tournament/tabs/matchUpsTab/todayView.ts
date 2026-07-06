/**
 * Today-view aggregation for the matchUps-page segmented bar.
 *
 * Buckets a set of matchUp rows scheduled for a given ISO day into the five
 * day-of-play segments, using the shared classifier so the counts match what
 * clicking a segment filters to. The bar is scoped to `todayIso` and is
 * independent of the popover status filter, so it stays a stable dashboard of
 * every status while a status drill-down is active.
 */
import { classifyTodayBucket, TODAY_BUCKETS, TodayBucket } from 'components/tables/common/filters/matchUpStatusPredicates';
import { SegmentDef } from 'courthive-components';
import { t } from 'i18n';

export type TodayCounts = Record<TodayBucket, number>;

// Segment colours reuse the ecosystem status tokens (both light/dark themed).
export function getTodaySegments(): SegmentDef[] {
  return [
    { key: 'complete', label: t('pages.matchUps.complete'), color: 'var(--chc-status-success, #16a34a)' },
    { key: 'live', label: t('pages.matchUps.live'), color: 'var(--chc-status-info, #3b82f6)' },
    { key: 'suspended', label: t('pages.matchUps.suspended'), color: 'var(--chc-status-warning, #d97706)' },
    { key: 'readyToScore', label: t('pages.matchUps.readyToScore'), color: 'var(--chc-status-teal, #0d9488)' },
    { key: 'notReady', label: t('pages.matchUps.notReady'), color: 'var(--chc-text-muted, #6b7280)' },
  ];
}

function emptyCounts(): TodayCounts {
  return { complete: 0, live: 0, suspended: 0, readyToScore: 0, notReady: 0 };
}

/**
 * Aggregate rows (Tabulator row objects or plain data) scheduled for `todayIso`
 * into the five Today buckets.
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
