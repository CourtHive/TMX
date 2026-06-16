import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the engine BEFORE importing the helper so the module captures
// the mock reference. ratingsParameters has known entries for UTR,
// WTN, NTRP, etc. — pick a recognised scale (UTR) for the positive
// case and a fabricated scale ('XYZ') to exercise the unknown-scale
// filter path.
const getParticipantsMock = vi.fn();

vi.mock('services/factory/engine', () => ({
  tournamentEngine: {
    getParticipants: (...args: any[]) => getParticipantsMock(...args),
  },
}));

import { getPresentRatings } from './getPresentRatings';

describe('getPresentRatings', () => {
  beforeEach(() => {
    getParticipantsMock.mockReset();
  });

  it('returns scaleNames present on SINGLES ratings of fetched participants', () => {
    getParticipantsMock.mockReturnValue({
      participants: [
        { ratings: { SINGLES: [{ scaleName: 'UTR' }] } },
        { ratings: { SINGLES: [{ scaleName: 'WTN' }, { scaleName: 'UTR' }] } },
      ],
    });
    const result = getPresentRatings();
    expect(result).toEqual(new Set(['UTR', 'WTN']));
    // One factory call per invocation when no participants are supplied
    // — the helper pulls them itself.
    expect(getParticipantsMock).toHaveBeenCalledTimes(1);
  });

  it('skips unknown scaleNames (no parameters in fixtures)', () => {
    getParticipantsMock.mockReturnValue({
      participants: [
        { ratings: { SINGLES: [{ scaleName: 'UTR' }, { scaleName: 'NOT_A_REAL_SCALE' }] } },
      ],
    });
    const result = getPresentRatings();
    expect(result.has('UTR')).toBe(true);
    expect(result.has('NOT_A_REAL_SCALE')).toBe(false);
  });

  it('accepts a participants list directly and skips the factory call', () => {
    const participants = [{ ratings: { SINGLES: [{ scaleName: 'UTR' }] } }];
    const result = getPresentRatings(participants);
    expect(result).toEqual(new Set(['UTR']));
    expect(getParticipantsMock).not.toHaveBeenCalled();
  });

  it('returns an empty set when no participants exist', () => {
    getParticipantsMock.mockReturnValue({ participants: [] });
    expect(getPresentRatings()).toEqual(new Set());
  });

  it('tolerates participants missing the ratings field', () => {
    getParticipantsMock.mockReturnValue({
      participants: [{ participantId: 'p1' }, { participantId: 'p2', ratings: {} }],
    });
    expect(getPresentRatings()).toEqual(new Set());
  });
});
