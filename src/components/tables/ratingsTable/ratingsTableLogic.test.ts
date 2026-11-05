import { ratedMatchUpIds, ratingsPolicyCaption } from './ratingsTableLogic';
import { describe, expect, it } from 'vitest';

describe('ratingsTableLogic', () => {
  it('rates matchUps with a winner and completed draws, not unfinished ones', () => {
    const matchUps = [
      { matchUpId: 'won', winningSide: 1, matchUpStatus: 'COMPLETED' },
      { matchUpId: 'drawn', matchUpStatus: 'COMPLETED' },
      { matchUpId: 'walkover', winningSide: 2, matchUpStatus: 'WALKOVER' },
      { matchUpId: 'unplayed', matchUpStatus: 'TO_BE_PLAYED' },
      { matchUpId: 'cancelled', matchUpStatus: 'CANCELLED' },
    ];
    expect(ratedMatchUpIds(matchUps)).toEqual(['won', 'drawn', 'walkover']);
  });

  it('names the ratings policies that produced the values', () => {
    expect(ratingsPolicyCaption(['Elo, Huang 2014 (flat K)'])).toEqual('Elo, Huang 2014 (flat K)');
    expect(ratingsPolicyCaption(['World Football Elo', 'FIFA SUM'])).toEqual('World Football Elo, FIFA SUM');
    expect(ratingsPolicyCaption([])).toBeUndefined();
    expect(ratingsPolicyCaption()).toBeUndefined();
  });
});
