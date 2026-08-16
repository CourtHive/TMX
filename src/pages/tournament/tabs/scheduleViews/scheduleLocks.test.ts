import { buildScheduleLockMethod, hasScheduleLockRecord, isScheduleLocked, lockedInDrop } from './scheduleLocks';
import { describe, expect, it } from 'vitest';

import { SET_MATCHUP_SCHEDULE_LOCK } from 'constants/mutationConstants';

/**
 * The factory is the authority on schedule locks; these helpers only drive the
 * grid affordance, the menu label and the drag confirmation. The cases below
 * mirror the two inertness rules in `factory/src/query/matchUp/isScheduleLocked.ts`
 * so the two cannot drift apart silently.
 */

// `over` is spread BEFORE schedule so an override of one schedule field does
// not silently drop the placement — which would make every lock read as inert.
const placed = (over: any = {}) => ({
  matchUpId: 'm1',
  matchUpStatus: 'TO_BE_PLAYED',
  ...over,
  schedule: { scheduledDate: '2026-06-22', scheduledTime: '19:00', courtId: 'c1', ...over.schedule },
});

const locked = (over: any = {}) => placed({ ...over, schedule: { lock: { reason: 'featured' }, ...over.schedule } });

describe('isScheduleLocked', () => {
  it('is true for a placed matchUp carrying a lock', () => {
    expect(isScheduleLocked(locked())).toBe(true);
  });

  it('is false without a lock', () => {
    expect(isScheduleLocked(placed())).toBe(false);
  });

  it('is inert once the matchUp is completed — completed status already protects it', () => {
    expect(isScheduleLocked(locked({ matchUpStatus: 'COMPLETED' }))).toBe(false);
    expect(isScheduleLocked(locked({ matchUpStatus: 'RETIRED' }))).toBe(false);
  });

  it('is inert with no placement to guard, so an unscheduled matchUp stays schedulable', () => {
    const unplaced = { matchUpId: 'm1', matchUpStatus: 'TO_BE_PLAYED', schedule: { lock: {} } };
    expect(isScheduleLocked(unplaced)).toBe(false);
    // …but the record is still there, which is what the factory preserves
    expect(hasScheduleLockRecord(unplaced)).toBe(true);
  });

  it('reads a nested matchUp, as grid cell data supplies it', () => {
    expect(isScheduleLocked({ matchUp: locked() })).toBe(true);
  });

  it('ignores a non-object lock value', () => {
    expect(isScheduleLocked(placed({ schedule: { lock: 'yes' } }))).toBe(false);
  });

  it('treats an allocation-only placement as placed (TEAM matchUps)', () => {
    const teamLocked = {
      matchUpId: 'm1',
      schedule: { lock: {}, allocatedCourts: [{ courtId: 'c1' }] },
    };
    expect(isScheduleLocked(teamLocked)).toBe(true);
  });
});

describe('buildScheduleLockMethod', () => {
  it('locks with a caller-supplied timestamp — the factory never stamps wall-clock', () => {
    const { method, params } = buildScheduleLockMethod({ matchUpId: 'm1', drawId: 'd1', locked: true });
    expect(method).toEqual(SET_MATCHUP_SCHEDULE_LOCK);
    expect(params.matchUpId).toEqual('m1');
    expect(params.drawId).toEqual('d1');
    expect(typeof params.lock.lockedAt).toEqual('string');
    expect(Number.isNaN(Date.parse(params.lock.lockedAt))).toBe(false);
  });

  it('carries a reason when one is given', () => {
    const { params } = buildScheduleLockMethod({ matchUpId: 'm1', drawId: 'd1', locked: true, reason: 'broadcast' });
    expect(params.lock.reason).toEqual('broadcast');
  });

  it('unlocks with a null lock', () => {
    const { params } = buildScheduleLockMethod({ matchUpId: 'm1', drawId: 'd1', locked: false });
    expect(params.lock).toBeNull();
  });
});

describe('lockedInDrop', () => {
  it('reports the dragged matchUp when it is locked', () => {
    expect(lockedInDrop({ dragged: locked(), occupant: placed({ matchUpId: 'm2' }) })).toEqual(['m1']);
  });

  it('reports the occupant too — a drop displaces or swaps it', () => {
    const occupant = locked({ matchUpId: 'm2' });
    expect(lockedInDrop({ dragged: placed(), occupant })).toEqual(['m2']);
  });

  it('reports both sides of a locked swap', () => {
    expect(lockedInDrop({ dragged: locked(), occupant: locked({ matchUpId: 'm2' }) })).toEqual(['m1', 'm2']);
  });

  it('is empty when nothing is locked, so the drop needs no confirmation', () => {
    expect(lockedInDrop({ dragged: placed(), occupant: placed({ matchUpId: 'm2' }) })).toEqual([]);
    expect(lockedInDrop({})).toEqual([]);
  });
});
