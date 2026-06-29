import { isMatchUpAwaitingReconciliation, refreshReconciliationIndex } from './delegatedReconciliation';
import { describe, it, expect } from 'vitest';

const CANONICAL = 'CANONICAL_PERSON';
const PERSON_OFFICIAL = 'person-official';
const PERSON_CROWD = 'person-crowd';

const participants = [
  {
    participantId: 'p-1',
    participantRole: 'OFFICIAL',
    person: { personOtherIds: [{ organisationId: CANONICAL, personId: PERSON_OFFICIAL }] },
  },
];

describe('delegatedReconciliation index', () => {
  it('indexes completed matchUps with a non-participant delegated scorekeeper', () => {
    refreshReconciliationIndex(
      [
        { matchUpId: 'mu-crowd', winningSide: 1, delegatedOutcome: { scorer: { personId: PERSON_CROWD } } },
        { matchUpId: 'mu-official', winningSide: 1, delegatedOutcome: { scorer: { personId: PERSON_OFFICIAL } } },
        { matchUpId: 'mu-plain', winningSide: 1 },
      ],
      participants,
    );
    expect(isMatchUpAwaitingReconciliation('mu-crowd')).toBe(true);
    expect(isMatchUpAwaitingReconciliation('mu-official')).toBe(false);
    expect(isMatchUpAwaitingReconciliation('mu-plain')).toBe(false);
    expect(isMatchUpAwaitingReconciliation(undefined)).toBe(false);
  });

  it('skips matchUps without a matchUpId and tolerates undefined participants', () => {
    refreshReconciliationIndex(
      [
        { winningSide: 1, delegatedOutcome: { scorer: { personId: PERSON_CROWD } } }, // no matchUpId → skipped
        { matchUpId: 'mu-ok', winningSide: 1, delegatedOutcome: { scorer: { personId: PERSON_CROWD } } },
      ],
      undefined as any,
    );
    expect(isMatchUpAwaitingReconciliation('mu-ok')).toBe(true);
  });

  it('clears entries on refresh', () => {
    refreshReconciliationIndex(
      [{ matchUpId: 'mu-crowd', winningSide: 1, delegatedOutcome: { scorer: { personId: PERSON_CROWD } } }],
      participants,
    );
    expect(isMatchUpAwaitingReconciliation('mu-crowd')).toBe(true);
    refreshReconciliationIndex([], participants);
    expect(isMatchUpAwaitingReconciliation('mu-crowd')).toBe(false);
  });
});
