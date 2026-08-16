import {
  classifyTodayBucket,
  popoverStatusPredicate,
  isWalkoverProfile,
  TODAY_BUCKETS,
} from './matchUpStatusPredicates';
import { describe, expect, it } from 'vitest';

// Minimal row builder — mirrors the fields mapMatchUp surfaces that the
// predicates read (top-level matchUpStatus + winningSide/complete/score/readyToScore).
const row = (over: any = {}) => ({
  matchUpStatus: 'TO_BE_PLAYED',
  winningSide: undefined,
  complete: false,
  readyToScore: false,
  score: undefined,
  competitiveProfile: undefined,
  ...over,
});

// A call stamped at 14:00 LOCAL on the given day, expressed as the ISO instant
// the factory stores — keeps the expectations timezone-independent.
const calledAtOn = (isoDate: string) => new Date(`${isoDate}T14:00:00`).toISOString();
const DAY = '2026-08-16';
const PRIOR_DAY = '2026-08-15';

describe('classifyTodayBucket', () => {
  it('buckets a completed matchUp as complete', () => {
    expect(classifyTodayBucket(row({ matchUpStatus: 'COMPLETED', winningSide: 'side1', complete: true }))).toBe(
      'complete',
    );
  });

  it('buckets walkover/defaulted endings as complete', () => {
    expect(classifyTodayBucket(row({ matchUpStatus: 'DOUBLE_WALKOVER', complete: true }))).toBe('complete');
  });

  it('buckets SUSPENDED before live even with a partial score', () => {
    expect(classifyTodayBucket(row({ matchUpStatus: 'SUSPENDED', score: '6-4 2-3' }))).toBe('suspended');
  });

  it('buckets IN_PROGRESS as live', () => {
    expect(classifyTodayBucket(row({ matchUpStatus: 'IN_PROGRESS' }))).toBe('live');
  });

  it('buckets a partial score with no winner as live', () => {
    expect(classifyTodayBucket(row({ matchUpStatus: 'TO_BE_PLAYED', score: '6-4 2-3' }))).toBe('live');
  });

  it('buckets a ready-but-unstarted matchUp as readyToScore', () => {
    expect(classifyTodayBucket(row({ matchUpStatus: 'TO_BE_PLAYED', readyToScore: true }))).toBe('readyToScore');
  });

  it('buckets a ready matchUp called on its scheduled day as called', () => {
    const data = row({ calledAt: calledAtOn(DAY), scheduledDate: DAY, readyToScore: true });
    expect(classifyTodayBucket(data)).toBe('called');
  });

  it('ignores a calledAt stamp left over from an earlier day', () => {
    const data = row({ calledAt: calledAtOn(PRIOR_DAY), scheduledDate: DAY, readyToScore: true });
    expect(classifyTodayBucket(data)).toBe('readyToScore');
  });

  it('ignores an unparseable calledAt', () => {
    const data = row({ scheduledDate: DAY, readyToScore: true, calledAt: 'not-a-date' });
    expect(classifyTodayBucket(data)).toBe('readyToScore');
  });

  it('treats a call with no scheduledDate as called', () => {
    const data = row({ calledAt: calledAtOn(DAY), readyToScore: true });
    expect(classifyTodayBucket(data)).toBe('called');
  });

  it('keeps a called matchUp that has started in live, not called', () => {
    const data = row({
      matchUpStatus: 'IN_PROGRESS',
      calledAt: calledAtOn(DAY),
      scheduledDate: DAY,
      readyToScore: true,
    });
    expect(classifyTodayBucket(data)).toBe('live');
  });

  it('buckets an unready matchUp as notReady even when called', () => {
    expect(classifyTodayBucket(row({ calledAt: calledAtOn(DAY), scheduledDate: DAY }))).toBe('notReady');
  });

  it('always returns one of the known buckets', () => {
    const bucket = classifyTodayBucket(row({ matchUpStatus: 'RETIRED', complete: true }));
    expect(TODAY_BUCKETS).toContain(bucket);
  });
});

describe('popoverStatusPredicate', () => {
  it('folds SUSPENDED into "to be played"', () => {
    expect(popoverStatusPredicate(row({ matchUpStatus: 'SUSPENDED' }), 'toBePlayed')).toBe(true);
    expect(popoverStatusPredicate(row({ matchUpStatus: 'TO_BE_PLAYED' }), 'toBePlayed')).toBe(true);
    expect(popoverStatusPredicate(row({ matchUpStatus: 'COMPLETED', winningSide: 'side1' }), 'toBePlayed')).toBe(false);
  });

  it('matches the dedicated suspended token only for SUSPENDED', () => {
    expect(popoverStatusPredicate(row({ matchUpStatus: 'SUSPENDED' }), 'suspended')).toBe(true);
    expect(popoverStatusPredicate(row({ matchUpStatus: 'TO_BE_PLAYED' }), 'suspended')).toBe(false);
  });

  it('matches the dedicated abandoned / cancelled tokens (non-directing, not irregular endings)', () => {
    expect(popoverStatusPredicate(row({ matchUpStatus: 'ABANDONED' }), 'abandoned')).toBe(true);
    expect(popoverStatusPredicate(row({ matchUpStatus: 'CANCELLED' }), 'abandoned')).toBe(false);
    expect(popoverStatusPredicate(row({ matchUpStatus: 'CANCELLED' }), 'cancelled')).toBe(true);
    expect(popoverStatusPredicate(row({ matchUpStatus: 'ABANDONED' }), 'cancelled')).toBe(false);
    // they are NOT irregular endings (which produce a winner)
    expect(popoverStatusPredicate(row({ matchUpStatus: 'ABANDONED' }), 'irregularEnding')).toBe(false);
    expect(popoverStatusPredicate(row({ matchUpStatus: 'CANCELLED' }), 'irregularEnding')).toBe(false);
  });

  it('an unknown/absent filter value includes everything', () => {
    expect(popoverStatusPredicate(row(), '')).toBe(true);
  });
});

describe('isWalkoverProfile', () => {
  it('is true for walkover/defaulted statuses only', () => {
    expect(isWalkoverProfile(row({ matchUpStatus: 'WALKOVER' }))).toBe(true);
    expect(isWalkoverProfile(row({ matchUpStatus: 'DEFAULTED' }))).toBe(true);
    expect(isWalkoverProfile(row({ matchUpStatus: 'COMPLETED' }))).toBe(false);
  });
});

describe('popoverStatusPredicate — schedule lock', () => {
  it('matches rows the factory predicate marked locked at map time', () => {
    expect(popoverStatusPredicate(row({ scheduleLocked: true }), 'scheduleLocked')).toBe(true);
    expect(popoverStatusPredicate(row({ scheduleLocked: false }), 'scheduleLocked')).toBe(false);
    expect(popoverStatusPredicate(row(), 'scheduleLocked')).toBe(false);
  });

  it('does not disturb the status options it sits beside', () => {
    const lockedAndComplete = row({ scheduleLocked: true, matchUpStatus: 'COMPLETED', winningSide: 'side1' });
    expect(popoverStatusPredicate(lockedAndComplete, 'complete')).toBe(true);
    expect(popoverStatusPredicate(row({ scheduleLocked: true }), 'toBePlayed')).toBe(true);
  });
});
