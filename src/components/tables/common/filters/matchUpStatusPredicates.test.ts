import { classifyTodayBucket, popoverStatusPredicate, isWalkoverProfile, TODAY_BUCKETS } from './matchUpStatusPredicates';
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

describe('classifyTodayBucket', () => {
  it('buckets a completed matchUp as complete', () => {
    expect(classifyTodayBucket(row({ matchUpStatus: 'COMPLETED', winningSide: 'side1', complete: true }))).toBe('complete');
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

  it('buckets an unready TO_BE_PLAYED as notReady', () => {
    expect(classifyTodayBucket(row({ matchUpStatus: 'TO_BE_PLAYED' }))).toBe('notReady');
  });

  it('always returns one of the five known buckets', () => {
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
