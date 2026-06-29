import {
  buildDelegatedOutcome,
  findDelegatedReconciliationIssues,
  readDelegatedOutcome,
} from './delegatedOutcome';
import { describe, it, expect } from 'vitest';

const CANONICAL = 'CANONICAL_PERSON';

function participant(personId: string, role = 'OFFICIAL') {
  return {
    participantId: `p-${personId}`,
    participantName: 'Someone',
    participantRole: role,
    person: { personOtherIds: [{ organisationId: CANONICAL, personId }] },
  };
}

describe('readDelegatedOutcome', () => {
  it('reads a first-class delegatedOutcome', () => {
    expect(readDelegatedOutcome({ delegatedOutcome: { winningSide: 1 } })).toEqual({ winningSide: 1 });
  });

  it('reads a delegatedOutcome stored as an extension', () => {
    const matchUp = { extensions: [{ name: 'delegatedOutcome', value: { winningSide: 2 } }] };
    expect(readDelegatedOutcome(matchUp)).toEqual({ winningSide: 2 });
  });

  it('returns undefined when absent', () => {
    expect(readDelegatedOutcome({ extensions: [] })).toBeUndefined();
    expect(readDelegatedOutcome(null)).toBeUndefined();
  });
});

describe('buildDelegatedOutcome', () => {
  it('guarantees the factory-required side score strings and attaches the scorer', () => {
    const outcome = buildDelegatedOutcome({
      score: { sets: [{ setNumber: 1, side1Score: 6, side2Score: 4 }] },
      winningSide: 1,
      matchUpStatus: 'COMPLETED',
      scoreStringSide1: '6-4',
      scoreStringSide2: '4-6',
      scorer: { personId: 'person-x', displayName: 'Crowd Carl' },
    });
    expect(outcome.score.scoreStringSide1).toBe('6-4');
    expect(outcome.score.scoreStringSide2).toBe('4-6');
    expect(outcome.score.sets).toHaveLength(1);
    expect(outcome.scorer).toEqual({ personId: 'person-x', displayName: 'Crowd Carl' });
    expect(outcome.winningSide).toBe(1);
  });
});

describe('findDelegatedReconciliationIssues', () => {
  const participants = [participant('person-official')];

  it('flags a completed matchUp whose delegated scorekeeper is not a participant', () => {
    const matchUps = [
      {
        matchUpId: 'mu-1',
        winningSide: 1,
        delegatedOutcome: { scorer: { personId: 'person-crowd', displayName: 'Carl' } },
      },
    ];
    const issues = findDelegatedReconciliationIssues({ matchUps, participants });
    expect(issues).toHaveLength(1);
    expect(issues[0].matchUpId).toBe('mu-1');
    expect(issues[0].classification).toBe('crowd');
  });

  it('does NOT flag when the delegated scorekeeper is a participant/official', () => {
    const matchUps = [
      { matchUpId: 'mu-2', winningSide: 1, delegatedOutcome: { scorer: { personId: 'person-official' } } },
    ];
    expect(findDelegatedReconciliationIssues({ matchUps, participants })).toHaveLength(0);
  });

  it('does NOT flag an in-progress matchUp (no official winningSide yet)', () => {
    const matchUps = [
      { matchUpId: 'mu-3', delegatedOutcome: { scorer: { personId: 'person-crowd' } } },
    ];
    expect(findDelegatedReconciliationIssues({ matchUps, participants })).toHaveLength(0);
  });

  it('flags an anonymous (no personId) delegated scorekeeper on a completed matchUp', () => {
    const matchUps = [{ matchUpId: 'mu-4', matchUpStatus: 'COMPLETED', delegatedOutcome: { scorer: { personId: null } } }];
    const issues = findDelegatedReconciliationIssues({ matchUps, participants });
    expect(issues).toHaveLength(1);
    expect(issues[0].classification).toBe('anonymous');
  });

  it('ignores matchUps without a delegatedOutcome', () => {
    expect(findDelegatedReconciliationIssues({ matchUps: [{ matchUpId: 'mu-5', winningSide: 1 }], participants })).toHaveLength(0);
  });
});
