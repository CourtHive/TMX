import { STATUS_BUCKETS, statusBucketOf } from 'components/tables/common/filters/matchUpStatusPredicates';
import { bucketCounts, rowsPassingOthers } from './statusQuickStrip';
import { describe, expect, it } from 'vitest';

/**
 * The status chips' buckets are a partition, and a footer count is the rows that chip would show: every other
 * filter applied, the status chips not (CA 2026-11-08).
 */
const ROWS = [
  { matchUpType: 'SINGLES', matchUpStatus: 'TO_BE_PLAYED' },
  { matchUpType: 'SINGLES', matchUpStatus: 'TO_BE_PLAYED', readyToScore: true },
  { matchUpType: 'DOUBLES', matchUpStatus: 'IN_PROGRESS' },
  { matchUpType: 'SINGLES', matchUpStatus: 'SUSPENDED' },
  { matchUpType: 'SINGLES', matchUpStatus: 'COMPLETED', winningSide: 1 },
  { matchUpType: 'DOUBLES', matchUpStatus: 'DOUBLE_WALKOVER' },
  { matchUpType: 'SINGLES', matchUpStatus: 'RETIRED', winningSide: 2 },
];

describe('statusBucketOf', () => {
  it('puts every matchUp in exactly one of the four buckets', () => {
    expect(ROWS.map(statusBucketOf)).toEqual([
      'toBePlayed',
      'toBePlayed',
      'live',
      'suspended',
      'complete',
      'complete',
      'complete',
    ]);
    expect(ROWS.every((row) => STATUS_BUCKETS.includes(statusBucketOf(row)))).toBe(true);
  });
});

describe('footer counts', () => {
  const singlesOnly = (row: any) => row.matchUpType === 'SINGLES';
  const statusChips = (row: any) => statusBucketOf(row) === 'complete';
  const table = (filters: any[]) => ({
    getFilters: () => filters.map((field) => ({ field })),
    getData: () => ROWS,
  });

  it('apply every other filter, never the status chips', () => {
    const rows = rowsPassingOthers(table([singlesOnly, statusChips]), statusChips);
    expect(bucketCounts(rows)).toEqual({ toBePlayed: 2, live: 0, suspended: 1, complete: 2 });
  });

  it('with no other filter, count every row', () => {
    expect(bucketCounts(rowsPassingOthers(table([statusChips]), statusChips))).toEqual({
      toBePlayed: 2,
      live: 1,
      suspended: 1,
      complete: 3,
    });
  });
});
