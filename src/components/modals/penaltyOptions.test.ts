import { penaltyParticipantOptions, penaltyTypeOptions } from './penaltyOptions';
import { penaltyConstants } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

const individual = (id: string) => ({ participantId: id, participantName: `Name ${id}` });

describe('penaltyTypeOptions', () => {
  it('lists each penalty code once, however many names the constants give it', () => {
    const values = penaltyTypeOptions().map(({ value }) => value);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toContain('EQUIPMENT_VIOLATION');
    expect(values).not.toContain('EQUIMENT_VIOLATION');
    expect(values.length).toBe(new Set(Object.values(penaltyConstants)).size);
  });
});

describe('penaltyParticipantOptions', () => {
  const singles = {
    sides: [
      { sideNumber: 1, participant: individual('a') },
      { sideNumber: 2, participant: individual('b') },
    ],
  };
  const doubles = {
    sides: [
      {
        sideNumber: 1,
        participant: { participantId: 'p1', individualParticipants: [individual('a'), individual('b')] },
      },
      {
        sideNumber: 2,
        participant: { participantId: 'p2', individualParticipants: [individual('c'), individual('d')] },
      },
    ],
  };

  it('offers the individuals of both sides, or of the side asked for', () => {
    expect(penaltyParticipantOptions(singles).map(({ value }) => value)).toEqual(['a', 'b']);
    expect(penaltyParticipantOptions(singles, 2)).toEqual([{ label: 'Name b', value: 'b' }]);
  });

  it('offers the members of a pair rather than the pair', () => {
    expect(penaltyParticipantOptions(doubles).map(({ value }) => value)).toEqual(['a', 'b', 'c', 'd']);
    expect(penaltyParticipantOptions(doubles, 1).map(({ value }) => value)).toEqual(['a', 'b']);
  });

  it('offers no one for a side not yet filled', () => {
    expect(penaltyParticipantOptions({ sides: [{ sideNumber: 1 }, { sideNumber: 2 }] })).toEqual([]);
    expect(penaltyParticipantOptions(undefined)).toEqual([]);
  });
});
