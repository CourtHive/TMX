import {
  buildAcceptMethods,
  buildConfirmMethods,
  buildDelegatedOutcome,
  findDelegatedReconciliationIssues,
  matchUpDelegationIssue,
  readDelegatedOutcome,
  sessionIsComplete,
  snapshotToSets,
} from './delegatedOutcome';
import { REMOVE_DELEGATED_OUTCOME, SET_DELEGATED_OUTCOME, SET_MATCHUP_STATUS } from 'constants/mutationConstants';
import { describe, it, expect } from 'vitest';

const CANONICAL = 'CANONICAL_PERSON';
const PERSON_OFFICIAL = 'person-official';
const PERSON_CROWD = 'person-crowd';

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

  it('reads the inContext _delegatedOutcome form (extension-surfaced)', () => {
    expect(readDelegatedOutcome({ _delegatedOutcome: { winningSide: 1 } })).toEqual({ winningSide: 1 });
  });

  it('returns undefined when absent', () => {
    expect(readDelegatedOutcome({ extensions: [] })).toBeUndefined();
    expect(readDelegatedOutcome(null)).toBeUndefined();
  });
});

describe('buildDelegatedOutcome', () => {
  it('passes the canonical score through and attaches the scorer', () => {
    const outcome = buildDelegatedOutcome({
      score: { sets: [{ setNumber: 1, side1Score: 6, side2Score: 4, winningSide: 1 }] },
      winningSide: 1,
      matchUpStatus: 'COMPLETED',
      scorer: { personId: 'person-x', displayName: 'Crowd Carl' },
    });
    expect(outcome.score.sets).toHaveLength(1);
    // No caller-side side-string derivation — the factory derives them.
    expect(outcome.score.scoreStringSide1).toBeUndefined();
    expect(outcome.scorer).toEqual({ personId: 'person-x', displayName: 'Crowd Carl' });
    expect(outcome.winningSide).toBe(1);
  });
});

describe('snapshotToSets', () => {
  it('maps a relay snapshot to TODS sets', () => {
    const sets = snapshotToSets({
      sets: [{ setNumber: 1, side1Score: 6, side2Score: 4, side1TiebreakScore: undefined, winningSide: 1 }],
    });
    expect(sets).toEqual([
      {
        setNumber: 1,
        side1Score: 6,
        side2Score: 4,
        side1TiebreakScore: undefined,
        side2TiebreakScore: undefined,
        winningSide: 1,
      },
    ]);
  });

  it('returns an empty array for an empty/absent snapshot', () => {
    expect(snapshotToSets(undefined)).toEqual([]);
  });
});

describe('buildConfirmMethods', () => {
  it('promotes the delegated score to official then clears the delegated marker', () => {
    const methods = buildConfirmMethods({
      matchUpId: 'mu-1',
      drawId: 'd-1',
      delegatedOutcome: { score: { sets: [{ setNumber: 1, side1Score: 6, side2Score: 4 }] }, winningSide: 1 },
    });
    expect(methods).toHaveLength(2);
    expect(methods[0].method).toBe('setMatchUpStatus');
    expect(methods[0].params.outcome.winningSide).toBe(1);
    expect(methods[1].method).toBe('removeDelegatedOutcome');
    expect(methods[1].params).toEqual({ matchUpId: 'mu-1', drawId: 'd-1' });
  });
});

describe('findDelegatedReconciliationIssues', () => {
  const participants = [participant(PERSON_OFFICIAL)];

  it('flags a completed matchUp whose delegated scorekeeper is not a participant', () => {
    const matchUps = [
      {
        matchUpId: 'mu-1',
        winningSide: 1,
        delegatedOutcome: { scorer: { personId: PERSON_CROWD, displayName: 'Carl' } },
      },
    ];
    const issues = findDelegatedReconciliationIssues({ matchUps, participants });
    expect(issues).toHaveLength(1);
    expect(issues[0].matchUpId).toBe('mu-1');
    expect(issues[0].classification).toBe('crowd');
  });

  it('does NOT flag when the delegated scorekeeper is a participant/official', () => {
    const matchUps = [
      { matchUpId: 'mu-2', winningSide: 1, delegatedOutcome: { scorer: { personId: PERSON_OFFICIAL } } },
    ];
    expect(findDelegatedReconciliationIssues({ matchUps, participants })).toHaveLength(0);
  });

  it('does NOT flag an in-progress matchUp (no official winningSide yet)', () => {
    const matchUps = [
      { matchUpId: 'mu-3', delegatedOutcome: { scorer: { personId: PERSON_CROWD } } },
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

  it('tolerates absent matchUps/participants', () => {
    expect(findDelegatedReconciliationIssues({} as any)).toEqual([]);
  });
});

describe('matchUpDelegationIssue', () => {
  const participants = [participant(PERSON_OFFICIAL)];

  it('flags a single completed matchUp with a non-participant delegated scorekeeper', () => {
    const matchUp = { matchUpId: 'mu-1', winningSide: 1, delegatedOutcome: { scorer: { personId: PERSON_CROWD } } };
    expect(matchUpDelegationIssue(matchUp, participants)?.classification).toBe('crowd');
  });

  it('returns undefined for a participant scorekeeper or no delegated outcome', () => {
    const ok = { matchUpId: 'mu-2', winningSide: 1, delegatedOutcome: { scorer: { personId: PERSON_OFFICIAL } } };
    expect(matchUpDelegationIssue(ok, participants)).toBeUndefined();
    expect(matchUpDelegationIssue({ matchUpId: 'mu-3', winningSide: 1 }, participants)).toBeUndefined();
  });
});

describe('sessionIsComplete + buildAcceptMethods', () => {
  const session = (currentScore: any, personId = 'person-1') => ({
    sessionId: 's-1',
    currentScore,
    crowdScoredBy: { personId, displayName: 'Sam Scorekeeper' },
  });

  it('sessionIsComplete detects winningSide or COMPLETED', () => {
    expect(sessionIsComplete(session({ winningSide: 1 }))).toBe(true);
    expect(sessionIsComplete(session({ matchUpStatus: 'COMPLETED' }))).toBe(true);
    expect(sessionIsComplete(session({ sets: [{ side1Score: 3 }] }))).toBe(false);
    expect(sessionIsComplete(undefined)).toBe(false);
  });

  it('returns [] for an in-progress session (Accept only promotes)', () => {
    expect(buildAcceptMethods({ session: session({ sets: [{ side1Score: 3 }] }), matchUpId: 'm-1', drawId: 'd-1' })).toEqual([]);
  });

  it('builds set-delegated + confirm (setMatchUpStatus + remove) for a complete session', () => {
    const s = session({ winningSide: 1, matchUpStatus: 'COMPLETED', sets: [{ setNumber: 1, side1Score: 6, side2Score: 4, winningSide: 1 }] });
    const methods = buildAcceptMethods({ session: s, matchUpId: 'm-1', drawId: 'd-1' });
    expect(methods.map((m: any) => m.method)).toEqual([SET_DELEGATED_OUTCOME, SET_MATCHUP_STATUS, REMOVE_DELEGATED_OUTCOME]);
    const outcome = methods[0].params.outcome;
    expect(outcome.winningSide).toBe(1);
    expect(outcome.scorer.personId).toBe('person-1');
    expect(outcome.score.sets[0].side1Score).toBe(6);
    // confirm applies the same canonical outcome as the official score
    expect(methods[1].params.outcome.winningSide).toBe(1);
  });
});
