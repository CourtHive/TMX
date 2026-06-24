import { describe, it, expect, vi, beforeEach } from 'vitest';

// Engine is mocked so getExistingDrawIds can be exercised without a real
// competition engine. The mutable holder lets each test set the state shape.
let mockState: any = {};
vi.mock('services/factory/engine', () => ({
  competitionEngine: { getState: () => mockState },
}));

import {
  getExistingDrawIds,
  batchReferencesMissingDraw,
  partitionBatchesByDrawExistence,
  extractDeletedDrawIds,
} from './drawExistenceGuard';

const scheduleMethod = (matchUpId: string, drawId: string) => ({
  method: 'addMatchUpScheduleItems',
  params: { matchUpId, drawId, schedule: {}, removePriorValues: true },
});

describe('getExistingDrawIds', () => {
  beforeEach(() => {
    mockState = {};
  });

  it('collects drawIds across all events of all loaded tournament records', () => {
    mockState = {
      tournamentRecords: {
        t1: { events: [{ drawDefinitions: [{ drawId: 'a' }, { drawId: 'b' }] }] },
        t2: { events: [{ drawDefinitions: [{ drawId: 'c' }] }, { drawDefinitions: [{ drawId: 'd' }] }] },
      },
    };
    expect(getExistingDrawIds()).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('returns an empty set when no records / events / draws are present', () => {
    mockState = { tournamentRecords: { t1: {}, t2: { events: [{}] } } };
    expect(getExistingDrawIds()).toEqual(new Set());
  });

  it('tolerates an undefined state', () => {
    mockState = undefined;
    expect(getExistingDrawIds()).toEqual(new Set());
  });
});

describe('batchReferencesMissingDraw', () => {
  const existing = new Set(['drawA', 'drawB']);

  it('is false when every method references an existing draw', () => {
    const batch = [scheduleMethod('m1', 'drawA'), scheduleMethod('m2', 'drawB')];
    expect(batchReferencesMissingDraw(batch, existing)).toBe(false);
  });

  it('is true when any method references a draw absent from the set', () => {
    const batch = [scheduleMethod('m1', 'drawA'), scheduleMethod('m2', 'deletedDraw')];
    expect(batchReferencesMissingDraw(batch, existing)).toBe(true);
  });

  it('treats an empty-string drawId (an unschedule clear) as never missing', () => {
    const batch = [{ method: 'addMatchUpScheduleItems', params: { matchUpId: 'm1', drawId: '', schedule: {} } }];
    expect(batchReferencesMissingDraw(batch, existing)).toBe(false);
  });

  it('treats a method with no drawId as never missing', () => {
    const batch = [{ method: 'publishOrderOfPlay', params: {} }];
    expect(batchReferencesMissingDraw(batch, existing)).toBe(false);
  });
});

describe('extractDeletedDrawIds', () => {
  it('collects drawIds from deleteDrawDefinitions (drawIds array)', () => {
    const methods = [{ method: 'deleteDrawDefinitions', params: { drawIds: ['d1', 'd2'], eventId: 'e1' } }];
    expect(extractDeletedDrawIds(methods)).toEqual(['d1', 'd2']);
  });

  it('collects the drawId from deleteFlightAndFlightDraw (singular)', () => {
    expect(extractDeletedDrawIds([{ method: 'deleteFlightAndFlightDraw', params: { drawId: 'd9' } }])).toEqual(['d9']);
  });

  it('reads the method name from methodName as well as method', () => {
    expect(extractDeletedDrawIds([{ methodName: 'deleteFlightAndFlightDraw', params: { drawId: 'dX' } }])).toEqual([
      'dX',
    ]);
  });

  it('ignores non-deletion methods', () => {
    const methods = [
      { method: 'addMatchUpScheduleItems', params: { drawId: 'd1' } },
      { method: 'publishOrderOfPlay' },
    ];
    expect(extractDeletedDrawIds(methods)).toEqual([]);
  });

  it('tolerates empty / nullish input', () => {
    expect(extractDeletedDrawIds([])).toEqual([]);
    expect(extractDeletedDrawIds(undefined as any)).toEqual([]);
  });
});

describe('partitionBatchesByDrawExistence', () => {
  const existing = new Set(['drawA', 'drawB']);

  it('partitions by WHOLE batch so interdependent swap methods stay atomic', () => {
    // A swap batch references two draws; one was deleted → the entire batch is stale.
    const swapBatch = [scheduleMethod('occupant', 'drawA'), scheduleMethod('dragged', 'deletedDraw')];
    const cleanBatch = [scheduleMethod('m3', 'drawB')];

    const { valid, stale } = partitionBatchesByDrawExistence([cleanBatch, swapBatch], existing);

    expect(valid).toEqual([cleanBatch]);
    expect(stale).toEqual([swapBatch]);
  });

  it('returns all batches as valid when no draw is missing', () => {
    const batches = [[scheduleMethod('m1', 'drawA')], [scheduleMethod('m2', 'drawB')]];
    const { valid, stale } = partitionBatchesByDrawExistence(batches, existing);
    expect(valid).toHaveLength(2);
    expect(stale).toHaveLength(0);
  });

  it('returns all batches as stale when every batch references a deleted draw', () => {
    const batches = [[scheduleMethod('m1', 'goneA')], [scheduleMethod('m2', 'goneB')]];
    const { valid, stale } = partitionBatchesByDrawExistence(batches, existing);
    expect(valid).toHaveLength(0);
    expect(stale).toHaveLength(2);
  });
});
