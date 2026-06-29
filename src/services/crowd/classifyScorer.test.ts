import { classifyScorer } from './classifyScorer';
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
});
