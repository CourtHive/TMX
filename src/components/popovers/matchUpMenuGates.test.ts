import { matchUpMenuGates } from './matchUpMenuGates';
import { describe, expect, it } from 'vitest';

const sides = [{ participantId: 'p1' }, { participantId: 'p2' }];

describe('matchUpMenuGates', () => {
  it('offers everything to a match still to be played', () => {
    expect(matchUpMenuGates({ sides, matchUpStatus: 'TO_BE_PLAYED' })).toEqual({
      noParticipants: false,
      hideTimeOptions: false,
      hidePrePlay: false,
      hideCheckIn: false,
    });
  });

  // The reported defect: COMPLETED is absent from the terminal statuses, so a finished match offered check-in,
  // a scorekeeper nomination, a match card and a schedule clear (CA, 2026-10-30).
  it('withholds the pre-play actions from a completed match but keeps its times editable', () => {
    const gates = matchUpMenuGates({ sides, matchUpStatus: 'COMPLETED', winningSide: 1 });
    expect(gates.hidePrePlay).toBe(true);
    expect(gates.hideCheckIn).toBe(true);
    expect(gates.hideTimeOptions).toBe(false);
  });

  it('treats a RETIRED match as finished', () => {
    const gates = matchUpMenuGates({ sides, matchUpStatus: 'RETIRED', winningSide: 2 });
    expect(gates.hidePrePlay).toBe(true);
    expect(gates.hideCheckIn).toBe(true);
    expect(gates.hideTimeOptions).toBe(false);
  });

  it('treats a COMPLETED tie (no winner) as finished', () => {
    expect(matchUpMenuGates({ sides, matchUpStatus: 'COMPLETED' }).hidePrePlay).toBe(true);
  });

  it('keeps an IN_PROGRESS match playable', () => {
    const gates = matchUpMenuGates({ sides, matchUpStatus: 'IN_PROGRESS', score: { sets: [{ side1Score: 3 }] } });
    expect(gates.hidePrePlay).toBe(false);
    expect(gates.hideCheckIn).toBe(false);
  });

  it('withholds times and check-in from a walkover', () => {
    const gates = matchUpMenuGates({ sides, matchUpStatus: 'WALKOVER', winningSide: 1 });
    expect(gates.hideTimeOptions).toBe(true);
    expect(gates.hideCheckIn).toBe(true);
    expect(gates.hidePrePlay).toBe(true);
  });

  it('withholds times and check-in until a participant is present', () => {
    const gates = matchUpMenuGates({ sides: [{}, {}], matchUpStatus: 'TO_BE_PLAYED' });
    expect(gates.noParticipants).toBe(true);
    expect(gates.hideTimeOptions).toBe(true);
    expect(gates.hideCheckIn).toBe(true);
  });

  it('tolerates an absent matchUp', () => {
    expect(matchUpMenuGates(undefined).noParticipants).toBe(true);
  });
});
