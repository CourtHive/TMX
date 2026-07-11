import { drawDefinitionConstants, entryStatusConstants } from 'tods-competition-factory';
import { segmentRank, SEGMENT_LABELS } from './segmentSorter';
import { describe, expect, it } from 'vitest';

const { QUALIFYING, MAIN } = drawDefinitionConstants;
const {
  STRUCTURE_SELECTED_STATUSES,
  DIRECT_ACCEPTANCE,
  CONFIRMED,
  ALTERNATE,
  UNGROUPED,
  WITHDRAWN,
  REGISTERED,
} = entryStatusConstants;

describe('segmentRank', () => {
  it('ranks every STRUCTURE_SELECTED_STATUS as accepted', () => {
    for (const status of STRUCTURE_SELECTED_STATUSES) {
      expect(segmentRank(MAIN, status)).toBe(0);
      expect(segmentRank(QUALIFYING, status)).toBe(1);
    }
  });

  it('ranks CONFIRMED entries as accepted, keeping them seedable', () => {
    // regression: CONFIRMED previously fell through to rank 5 ("?"),
    // which disabled the manual seeding editor for those rows
    expect(segmentRank(MAIN, CONFIRMED)).toBe(0);
    expect(SEGMENT_LABELS[segmentRank(MAIN, CONFIRMED)]).toBe('Accepted');
  });

  it('ranks non-accepted statuses in display order', () => {
    expect(segmentRank(MAIN, ALTERNATE)).toBe(2);
    expect(segmentRank(MAIN, UNGROUPED)).toBe(3);
    expect(segmentRank(MAIN, WITHDRAWN)).toBe(4);
  });

  it('ranks unknown statuses last', () => {
    expect(segmentRank(MAIN, REGISTERED)).toBe(5);
    expect(segmentRank(MAIN, 'NOT_A_STATUS')).toBe(5);
  });

  it('does not treat non-accepted statuses as qualifying at QUALIFYING stage', () => {
    expect(segmentRank(QUALIFYING, ALTERNATE)).toBe(2);
    expect(segmentRank(QUALIFYING, DIRECT_ACCEPTANCE)).toBe(1);
  });
});
