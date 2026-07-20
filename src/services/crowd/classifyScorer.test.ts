import {
  classifyScorer,
  hiveIdLinkedParticipants,
  isApprovedScorekeeper,
  isTrustedScorer,
  TRUSTED_SCORER_CLASSIFICATIONS,
} from './classifyScorer';
import { describe, it, expect } from 'vitest';

const CANONICAL = 'CANONICAL_PERSON';

function participant(overrides: any = {}) {
  return {
    participantId: 'p-1',
    participantName: 'Pat Official',
    participantRole: 'OFFICIAL',
    person: { personOtherIds: [{ organisationId: CANONICAL, personId: 'person-1' }] },
    ...overrides,
  };
}

describe('classifyScorer', () => {
  it('classifies a missing personId as anonymous', () => {
    expect(classifyScorer({ participants: [participant()], personId: null })).toEqual({
      classification: 'anonymous',
      personId: null,
      participantId: null,
      participantName: null,
    });
  });

  it('classifies an OFFICIAL-role participant as official', () => {
    const result = classifyScorer({ participants: [participant()], personId: 'person-1' });
    expect(result.classification).toBe('official');
    expect(result.participantId).toBe('p-1');
    expect(result.participantName).toBe('Pat Official');
  });

  it('classifies a non-official participant as participant', () => {
    const competitor = participant({
      participantId: 'p-2',
      participantRole: 'COMPETITOR',
      person: { personOtherIds: [{ organisationId: CANONICAL, personId: 'person-2' }] },
    });
    const result = classifyScorer({ participants: [competitor], personId: 'person-2' });
    expect(result.classification).toBe('participant');
    expect(result.participantId).toBe('p-2');
  });

  it('classifies a known person who is not a participant as crowd', () => {
    const result = classifyScorer({ participants: [participant()], personId: 'person-stranger' });
    expect(result.classification).toBe('crowd');
    expect(result.personId).toBe('person-stranger');
    expect(result.participantId).toBeNull();
  });

  it('does not match a personId carried under a different organisationId', () => {
    const other = participant({
      person: { personOtherIds: [{ organisationId: 'SOME_FEDERATION', personId: 'person-1' }] },
    });
    expect(classifyScorer({ participants: [other], personId: 'person-1' }).classification).toBe('crowd');
  });

  it('returns null participantId/name when the matched participant lacks them', () => {
    const bare = { participantRole: 'COMPETITOR', person: { personOtherIds: [{ organisationId: CANONICAL, personId: 'person-9' }] } };
    const result = classifyScorer({ participants: [bare], personId: 'person-9' });
    expect(result.classification).toBe('participant');
    expect(result.participantId).toBeNull();
    expect(result.participantName).toBeNull();
  });

  it('tolerates participants without a person / personOtherIds and an empty list', () => {
    expect(classifyScorer({ participants: undefined, personId: 'person-1' }).classification).toBe('crowd');
    expect(
      classifyScorer({ participants: [{ participantId: 'x' }, participant()], personId: 'person-1' }).classification,
    ).toBe('official');
  });

  it('classifies a participant carrying the SCOREKEEPER role as scorekeeper', () => {
    const sk = participant({
      participantId: 'p-3',
      participantRole: 'COMPETITOR',
      participantRoleResponsibilities: ['SCOREKEEPER'],
      person: { personOtherIds: [{ organisationId: CANONICAL, personId: 'person-3' }] },
    });
    const result = classifyScorer({ participants: [sk], personId: 'person-3' });
    expect(result.classification).toBe('scorekeeper');
    expect(result.participantId).toBe('p-3');
  });

  it('classifies a participant nominated for THIS matchUp as scorekeeper', () => {
    const competitor = participant({
      participantId: 'p-4',
      participantRole: 'COMPETITOR',
      person: { personOtherIds: [{ organisationId: CANONICAL, personId: 'person-4' }] },
    });
    const matchUp = { schedule: { scorekeeper: 'p-4' } };
    const result = classifyScorer({ participants: [competitor], personId: 'person-4', matchUp });
    expect(result.classification).toBe('scorekeeper');

    // Not nominated for a different matchUp → plain participant
    const other = { schedule: { scorekeeper: 'someone-else' } };
    expect(classifyScorer({ participants: [competitor], personId: 'person-4', matchUp: other }).classification).toBe(
      'participant',
    );
  });

  it('prefers official over scorekeeper when a participant is both', () => {
    const both = participant({
      participantRole: 'OFFICIAL',
      participantRoleResponsibilities: ['SCOREKEEPER'],
    });
    expect(classifyScorer({ participants: [both], personId: 'person-1' }).classification).toBe('official');
  });

  it('isTrustedScorer covers official + scorekeeper only', () => {
    expect(TRUSTED_SCORER_CLASSIFICATIONS).toEqual(['official', 'scorekeeper']);
    expect(isTrustedScorer('official')).toBe(true);
    expect(isTrustedScorer('scorekeeper')).toBe(true);
    expect(isTrustedScorer('participant')).toBe(false);
    expect(isTrustedScorer('crowd')).toBe(false);
    expect(isTrustedScorer('anonymous')).toBe(false);
  });
});

describe('hiveIdLinkedParticipants', () => {
  it('keeps only participants with a CANONICAL_PERSON personOtherId', () => {
    const a = { participantId: 'p-1', person: { personOtherIds: [{ organisationId: CANONICAL, personId: 'person-1' }] } };
    const b = { participantId: 'p-2', person: { personOtherIds: [{ organisationId: 'FED', personId: 'x' }] } };
    const c = { participantId: 'p-3' };
    const d = { participantId: 'p-4', person: { personOtherIds: [{ organisationId: CANONICAL }] } };
    expect(hiveIdLinkedParticipants([a, b, c, d]).map((p: any) => p.participantId)).toEqual(['p-1']);
  });

  it('tolerates undefined / empty input', () => {
    expect(hiveIdLinkedParticipants(undefined as any)).toEqual([]);
    expect(hiveIdLinkedParticipants([])).toEqual([]);
  });
});

describe('isApprovedScorekeeper', () => {
  it('is true for the SCOREKEEPER role or responsibility', () => {
    expect(isApprovedScorekeeper({ participantRole: 'SCOREKEEPER' })).toBe(true);
    expect(isApprovedScorekeeper({ participantRoleResponsibilities: ['SCOREKEEPER'] })).toBe(true);
    expect(isApprovedScorekeeper({ participantRole: 'COMPETITOR', participantRoleResponsibilities: ['CAPTAIN'] })).toBe(false);
    expect(isApprovedScorekeeper({})).toBe(false);
  });
});
