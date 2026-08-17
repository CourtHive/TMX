import { describe, expect, it, vi } from 'vitest';

const dateMatchUps: any[] = [];
const completedMatchUps: any[] = [];

vi.mock('services/factory/engine', () => ({
  competitionEngine: { competitionScheduleMatchUps: () => ({ dateMatchUps, completedMatchUps }) },
  tournamentEngine: {},
}));
vi.mock('services/mutation/mutationRequest', () => ({ mutationRequest: vi.fn() }));
vi.mock('components/modals/baseModal/baseModal', () => ({ confirmModal: vi.fn() }));
vi.mock('components/popovers/tipster', () => ({ tipster: vi.fn() }));
vi.mock('./scheduleToast', () => ({ scheduleToast: vi.fn() }));

import { hiddenCourtIds } from './visibilityState';
import { buildLockBuckets } from './scheduleLockActions';

const DATE = '2026-06-22';

const matchUp = (over: any = {}) => ({
  matchUpId: over.matchUpId ?? 'm1',
  matchUpStatus: 'TO_BE_PLAYED',
  drawId: 'd1',
  ...over,
  schedule: { scheduledDate: DATE, scheduledTime: '10:00', courtId: 'c1', ...over.schedule },
});

function setMatchUps(items: any[]) {
  dateMatchUps.length = 0;
  completedMatchUps.length = 0;
  dateMatchUps.push(...items);
}

describe('buildLockBuckets', () => {
  it('splits the day into what can be locked and what can be released', () => {
    setMatchUps([
      matchUp({ matchUpId: 'unlocked' }),
      matchUp({ matchUpId: 'locked', schedule: { lock: { reason: 'featured' } } }),
    ]);
    const { lockable, unlockable } = buildLockBuckets(DATE);
    expect(lockable.map((m) => m.matchUpId)).toEqual(['unlocked']);
    expect(unlockable.map((m) => m.matchUpId)).toEqual(['locked']);
  });

  it('excludes completed matchUps — a lock on one is inert', () => {
    // Unplaced matchUps need no exclusion here: the scope filter requires
    // `schedule.scheduledDate`, and a scheduledDate IS placement as far as the
    // factory predicate is concerned. So everything in scope is placed by
    // construction, and `canToggleScheduleLock` is doing the completed check.
    setMatchUps([
      matchUp({ matchUpId: 'done', matchUpStatus: 'COMPLETED', winningSide: 1 }),
      matchUp({ matchUpId: 'live' }),
    ]);
    const { lockable, unlockable } = buildLockBuckets(DATE);
    expect(lockable.map((m) => m.matchUpId)).toEqual(['live']);
    expect(unlockable).toEqual([]);
  });

  it('leaves a completed matchUp out of BOTH buckets even when it carries a lock', () => {
    setMatchUps([matchUp({ matchUpId: 'done', matchUpStatus: 'COMPLETED', winningSide: 1, schedule: { lock: {} } })]);
    const { lockable, unlockable } = buildLockBuckets(DATE);
    expect(lockable).toEqual([]);
    expect(unlockable).toEqual([]);
  });

  it('ignores other days', () => {
    setMatchUps([
      matchUp({ matchUpId: 'today' }),
      matchUp({ matchUpId: 'tomorrow', schedule: { scheduledDate: '2026-06-23' } }),
    ]);
    const { lockable } = buildLockBuckets(DATE);
    expect(lockable.map((m) => m.matchUpId)).toEqual(['today']);
  });

  it('respects the operator working scope — hidden courts are out of scope', () => {
    setMatchUps([matchUp({ matchUpId: 'visible' }), matchUp({ matchUpId: 'hidden', schedule: { courtId: 'c9' } })]);
    hiddenCourtIds.add('c9');
    try {
      const { lockable } = buildLockBuckets(DATE);
      expect(lockable.map((m) => m.matchUpId)).toEqual(['visible']);
    } finally {
      hiddenCourtIds.delete('c9');
    }
  });
});
