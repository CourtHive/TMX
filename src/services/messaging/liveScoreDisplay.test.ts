import { formatLiveScore, hasOfficialScore, overlayLiveScores, pickLiveScore, withLiveScore } from './liveScoreDisplay';
import { describe, expect, it } from 'vitest';

const live = (sets: any[]) => ({ lastSeenAt: '2026-10-24T00:00:00.000Z', score: { sets } });

describe('formatLiveScore', () => {
  it('formats sets from side 1 perspective', () => {
    expect(
      formatLiveScore({
        sets: [
          { setNumber: 1, side1Score: 6, side2Score: 3 },
          { setNumber: 2, side1Score: 2, side2Score: 1 },
        ],
      }),
    ).toBe('6-3 2-1');
  });

  it('appends the game points from the last set', () => {
    expect(
      formatLiveScore({ sets: [{ side1Score: 1, side2Score: 1, side1PointScore: '30', side2PointScore: '15' }] }),
    ).toBe('1-1 (30-15)');
  });

  it("shows a tiebreak set with the loser's tiebreak points", () => {
    expect(
      formatLiveScore({ sets: [{ side1Score: 7, side2Score: 6, side1TiebreakScore: 7, side2TiebreakScore: 5 }] }),
    ).toBe('7-6(5)');
    expect(
      formatLiveScore({ sets: [{ side1Score: 6, side2Score: 7, side1TiebreakScore: 4, side2TiebreakScore: 7 }] }),
    ).toBe('6-7(4)');
  });

  it("formats from side 2's perspective when asked", () => {
    const score = {
      sets: [
        { side1Score: 6, side2Score: 7, side1TiebreakScore: 4, side2TiebreakScore: 7 },
        { side1Score: 2, side2Score: 1, side1PointScore: '40', side2PointScore: '15' },
      ],
    };
    expect(formatLiveScore(score, 2)).toBe('7-6(4) 1-2 (15-40)');
  });

  it("falls back to the producer's string when it sent no sets", () => {
    expect(formatLiveScore({ sets: [], scoreStringSide1: '6-4 1-0' })).toBe('6-4 1-0');
  });

  it('is empty for no score', () => {
    expect(formatLiveScore(undefined)).toBe('');
  });
});

describe('hasOfficialScore', () => {
  it('is true for a winner, an ending status, or entered games', () => {
    expect(hasOfficialScore({ winningSide: 2 })).toBe(true);
    expect(hasOfficialScore({ matchUpStatus: 'RETIRED' })).toBe(true);
    expect(hasOfficialScore({ score: { sets: [{ side1Score: 1, side2Score: 0 }] } })).toBe(true);
  });

  it('is false for an unscored or empty-scaffold matchUp', () => {
    expect(hasOfficialScore({ matchUpStatus: 'TO_BE_PLAYED' })).toBe(false);
    expect(
      hasOfficialScore({ matchUpStatus: 'IN_PROGRESS', score: { sets: [{ side1Score: 0, side2Score: 0 }] } }),
    ).toBe(false);
  });
});

describe('overlayLiveScores', () => {
  const tracked = live([{ setNumber: 1, side1Score: 3, side2Score: 2 }]);
  const getLive = (id?: string) => (id === 'm1' ? tracked : undefined);

  it('replaces an unscored, tracked matchUp with an IN_PROGRESS display copy', () => {
    const original = { matchUpId: 'm1', matchUpStatus: 'TO_BE_PLAYED' };
    const [overlaid]: any[] = overlayLiveScores([original], getLive);
    expect(overlaid).not.toBe(original);
    expect(overlaid.matchUpStatus).toBe('IN_PROGRESS');
    expect(overlaid.score.sets).toEqual(tracked.score.sets);
    expect(overlaid.liveTracked).toBe(true);
    expect(overlaid.winningSide).toBeUndefined();
    expect(original).toEqual({ matchUpId: 'm1', matchUpStatus: 'TO_BE_PLAYED' });
  });

  it('does not share set objects with the store', () => {
    const [overlaid]: any[] = overlayLiveScores([{ matchUpId: 'm1' }], getLive);
    overlaid.score.sets[0].side1Score = 99;
    expect(tracked.score.sets[0].side1Score).toBe(3);
  });

  it('leaves untracked and officially scored matchUps as the same objects', () => {
    const untracked = { matchUpId: 'm2' };
    const official = { matchUpId: 'm1', winningSide: 1, matchUpStatus: 'COMPLETED' };
    const result = overlayLiveScores([untracked, official], getLive);
    expect(result[0]).toBe(untracked);
    expect(result[1]).toBe(official);
  });

  it('carries a tracker-reported winner on the sets but never on the matchUp', () => {
    const finished = live([{ setNumber: 1, side1Score: 6, side2Score: 0, winningSide: 1 }]);
    const [overlaid]: any[] = overlayLiveScores([{ matchUpId: 'm1' }], () => finished);
    expect(overlaid.score.sets[0].winningSide).toBe(1);
    expect(overlaid.winningSide).toBeUndefined();
    expect(overlaid.matchUpStatus).toBe('IN_PROGRESS');
  });
});

describe('pickLiveScore', () => {
  const tracker = live([{ setNumber: 1, side1Score: 4, side2Score: 4 }]);
  const crowd = { sessionId: 's1', currentScore: { sets: [{ setNumber: 1, side1Score: 2, side2Score: 1 }] } };

  it("prefers the tracker's score when both exist", () => {
    expect(pickLiveScore(tracker, crowd)).toBe(tracker);
  });

  it("falls back to the promoted crowd session's score, sanitized", () => {
    expect(pickLiveScore(undefined, { ...crowd, updatedAt: 'x' })).toEqual({
      lastSeenAt: 'x',
      score: { sets: [{ setNumber: 1, side1Score: 2, side2Score: 1 }] },
    });
  });

  it('is undefined with neither', () => {
    expect(pickLiveScore(undefined, undefined)).toBeUndefined();
  });
});

describe('withLiveScore', () => {
  it('gives the display copy both side strings, for renderers that show a string (the schedule cell)', () => {
    const live = { lastSeenAt: '', score: { sets: [{ setNumber: 1, side1Score: 4, side2Score: 3 }] } };
    const copy: any = withLiveScore({ matchUpId: 'm1' }, () => live);
    expect(copy.score.scoreStringSide1).toBe('4-3');
    expect(copy.score.scoreStringSide2).toBe('3-4');
    expect(copy.matchUpStatus).toBe('IN_PROGRESS');
  });
});
