import { describe, it, expect } from 'vitest';

import { ADD_MATCHUP_SCHEDULE_ITEMS } from 'constants/mutationConstants';
import {
  buildGridDropMethods,
  shouldRejectStripDrop,
  batchReferencesMissingDraw,
  partitionBatchesByDrawExistence,
  type GridDropPayload,
} from './gridDropMethods';

const scheduleMethod = (matchUpId: string, drawId: string) => ({
  method: ADD_MATCHUP_SCHEDULE_ITEMS,
  params: { matchUpId, drawId, schedule: {}, removePriorValues: true },
});

const DATE = '2026-06-21';
const target = { courtId: 'courtT', venueId: 'venueA', courtOrder: 1, scheduledTime: '09:00' };

const gridPayload = (overrides?: Partial<GridDropPayload>): GridDropPayload => ({
  type: 'GRID_MATCHUP',
  matchUp: { matchUpId: 'dragged', drawId: 'drawD' },
  source: { courtId: 'courtS', venueId: 'venueA', courtOrder: 5, scheduledTime: '08:00', scheduledDate: DATE },
  ...overrides,
});

const catalogPayload = (): GridDropPayload => ({
  type: 'CATALOG_MATCHUP',
  matchUp: { matchUpId: 'dragged', drawId: 'drawD' },
});

describe('buildGridDropMethods', () => {
  it('swaps two grid matchUps — trading court + order, each keeping its own time', () => {
    const methods = buildGridDropMethods({
      payload: gridPayload(),
      target,
      occupant: { matchUpId: 'occupant', drawId: 'drawO' },
      scheduledDate: DATE,
    });

    // clear both, then assign both
    expect(methods).toHaveLength(4);
    expect(methods.every((m) => m.method === ADD_MATCHUP_SCHEDULE_ITEMS)).toBe(true);
    expect(methods.every((m) => m.params.removePriorValues === true)).toBe(true);

    const [clearOccupant, clearDragged, assignDragged, assignOccupant] = methods;

    // occupant + dragged are both cleared before either is reassigned
    expect(clearOccupant.params.matchUpId).toBe('occupant');
    expect(clearOccupant.params.schedule).toEqual({
      scheduledTime: '',
      scheduledDate: '',
      courtOrder: '',
      venueId: '',
      courtId: '',
    });
    expect(clearDragged.params.matchUpId).toBe('dragged');

    // dragged → target slot (courtOrder 1) but KEEPS its own time (08:00)
    expect(assignDragged.params.matchUpId).toBe('dragged');
    expect(assignDragged.params.drawId).toBe('drawD');
    expect(assignDragged.params.schedule).toEqual({
      courtId: 'courtT',
      venueId: 'venueA',
      courtOrder: 1,
      scheduledDate: DATE,
      scheduledTime: '08:00',
    });

    // displaced occupant → the dragged matchUp's origin slot (courtOrder 5) but
    // KEEPS its own time (09:00 — the time it held in the target cell)
    expect(assignOccupant.params.matchUpId).toBe('occupant');
    expect(assignOccupant.params.drawId).toBe('drawO');
    expect(assignOccupant.params.schedule).toEqual({
      courtId: 'courtS',
      venueId: 'venueA',
      courtOrder: 5,
      scheduledDate: DATE,
      scheduledTime: '09:00',
    });
  });

  it('swap falls back to target venue + current date when source omits them', () => {
    const methods = buildGridDropMethods({
      payload: gridPayload({ source: { courtId: 'courtS', courtOrder: 5 } }),
      target,
      occupant: { matchUpId: 'occupant', drawId: 'drawO' },
      scheduledDate: DATE,
    });
    const assignOccupant = methods[3];
    expect(assignOccupant.params.schedule).toEqual({
      courtId: 'courtS',
      venueId: 'venueA', // fell back to target.venueId
      courtOrder: 5,
      scheduledDate: DATE, // fell back to scheduledDate
      scheduledTime: '09:00', // the occupant keeps its own time (target.scheduledTime)
    });
  });

  it('is a no-op when a matchUp is dropped onto the cell it already holds', () => {
    const methods = buildGridDropMethods({
      payload: gridPayload({ matchUp: { matchUpId: 'occupant', drawId: 'drawO' } }),
      target,
      occupant: { matchUpId: 'occupant', drawId: 'drawO' },
      scheduledDate: DATE,
    });
    expect(methods).toEqual([]);
  });

  it('places a grid matchUp on an empty cell — clears source then assigns, carrying its own time', () => {
    const methods = buildGridDropMethods({ payload: gridPayload(), target, occupant: null, scheduledDate: DATE });
    expect(methods).toHaveLength(2);
    expect(methods[0].params.matchUpId).toBe('dragged'); // clear source
    expect(methods[0].params.schedule.courtId).toBe('');
    // The matchUp's own time (08:00) travels with it to the new cell.
    expect(methods[1].params.schedule).toEqual({
      courtOrder: 1,
      scheduledDate: DATE,
      courtId: 'courtT',
      venueId: 'venueA',
      scheduledTime: '08:00',
    });
  });

  it('places a catalog matchUp on an empty cell — single assign, no source clear, no time', () => {
    const methods = buildGridDropMethods({ payload: catalogPayload(), target, occupant: null, scheduledDate: DATE });
    expect(methods).toHaveLength(1);
    expect(methods[0].params.matchUpId).toBe('dragged');
    expect(methods[0].params.schedule.courtId).toBe('courtT');
    // A catalog item has no scheduledTime to carry.
    expect(methods[0].params.schedule).not.toHaveProperty('scheduledTime');
  });

  it('returns a catalog occupant to the catalog (no swap) when a catalog matchUp lands on it', () => {
    const methods = buildGridDropMethods({
      payload: catalogPayload(),
      target,
      occupant: { matchUpId: 'occupant', drawId: 'drawO' },
      scheduledDate: DATE,
    });
    expect(methods).toHaveLength(2);
    expect(methods[0].params.matchUpId).toBe('occupant'); // unscheduled (back to catalog)
    expect(methods[0].params.schedule.courtId).toBe('');
    expect(methods[1].params.matchUpId).toBe('dragged'); // takes target cell
    expect(methods[1].params.schedule.courtId).toBe('courtT');
  });

  it('does not swap when the grid source lacks a courtOrder origin', () => {
    const methods = buildGridDropMethods({
      payload: gridPayload({ source: { courtId: 'courtS' } }), // courtOrder missing
      target,
      occupant: { matchUpId: 'occupant', drawId: 'drawO' },
      scheduledDate: DATE,
    });
    // fallback: clear occupant + clear dragged source + assign dragged → target
    expect(methods).toHaveLength(3);
    expect(methods[0].params.matchUpId).toBe('occupant');
    expect(methods[1].params.matchUpId).toBe('dragged');
    expect(methods[2].params.matchUpId).toBe('dragged');
    expect(methods[2].params.schedule.courtId).toBe('courtT');
  });

  it('swaps with no times on either side — both assignments get empty scheduledTime', () => {
    const methods = buildGridDropMethods({
      payload: gridPayload({ source: { courtId: 'courtS', venueId: 'venueA', courtOrder: 5 } }), // no time
      target: { courtId: 'courtT', venueId: 'venueA', courtOrder: 1 }, // no time
      occupant: { matchUpId: 'occupant', drawId: 'drawO' },
      scheduledDate: DATE,
    });
    expect(methods).toHaveLength(4);
    expect(methods[2].params.schedule.scheduledTime).toBe(''); // dragged
    expect(methods[3].params.schedule.scheduledTime).toBe(''); // displaced occupant
  });
});

describe('shouldRejectStripDrop', () => {
  it('rejects a grid drag onto an occupied Now cell held by a different matchUp', () => {
    expect(
      shouldRejectStripDrop({
        payloadType: 'GRID_MATCHUP',
        draggedMatchUpId: 'dragged',
        cellOccupied: true,
        occupantMatchUpId: 'someoneElse',
      }),
    ).toBe(true);
  });

  it('allows a grid drag onto an empty Now cell', () => {
    expect(
      shouldRejectStripDrop({ payloadType: 'GRID_MATCHUP', draggedMatchUpId: 'dragged', cellOccupied: false }),
    ).toBe(false);
  });

  it('allows re-dropping the same matchUp onto its own Now cell', () => {
    expect(
      shouldRejectStripDrop({
        payloadType: 'GRID_MATCHUP',
        draggedMatchUpId: 'dragged',
        cellOccupied: true,
        occupantMatchUpId: 'dragged',
      }),
    ).toBe(false);
  });

  it('never constrains catalog drags', () => {
    expect(
      shouldRejectStripDrop({
        payloadType: 'CATALOG_MATCHUP',
        draggedMatchUpId: 'dragged',
        cellOccupied: true,
        occupantMatchUpId: 'someoneElse',
      }),
    ).toBe(false);
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
    const batch = [{ method: ADD_MATCHUP_SCHEDULE_ITEMS, params: { matchUpId: 'm1', drawId: '', schedule: {} } }];
    expect(batchReferencesMissingDraw(batch as any, existing)).toBe(false);
  });

  it('treats a method with no drawId as never missing', () => {
    const batch = [{ method: 'publishOrderOfPlay', params: {} }];
    expect(batchReferencesMissingDraw(batch as any, existing)).toBe(false);
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
