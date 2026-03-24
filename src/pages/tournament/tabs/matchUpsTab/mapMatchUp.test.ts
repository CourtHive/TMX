import { describe, expect, it, vi } from 'vitest';

vi.mock('tods-competition-factory', () => ({
  eventConstants: { TEAM: 'TEAM' },
  tournamentEngine: {
    getParticipants: () => ({ participants: [{ participantName: 'Ref Jones' }] }),
  },
}));

vi.mock('normalize-text', () => ({
  normalizeDiacritics: (s: string) => s,
}));

import { mapMatchUp } from './mapMatchUp';

const makeMatchUp = (overrides: any = {}) => ({
  matchUpId: 'm1',
  matchUpType: 'SINGLES',
  eventName: 'U18 Singles',
  roundName: 'R16',
  eventId: 'e1',
  drawId: 'd1',
  drawName: 'Main',
  gender: 'MALE',
  schedule: {
    scheduledDate: '2025-03-24',
    scheduledTime: '10:00',
    courtName: 'Court 1',
    startTime: '10:05',
    endTime: '11:30',
  },
  sides: [
    { participant: { participantId: 'p1', participantName: 'Smith, John', person: { standardGivenName: 'John', standardFamilyName: 'Smith', sex: 'MALE' } } },
    { participant: { participantId: 'p2', participantName: 'Doe, Jane', person: { standardGivenName: 'Jane', standardFamilyName: 'Doe', sex: 'FEMALE' } } },
  ],
  ...overrides,
});

describe('mapMatchUp', () => {
  it('maps basic fields', () => {
    let result: any = mapMatchUp(makeMatchUp());
    expect(result.matchUpId).toBe('m1');
    expect(result.eventName).toBe('U18 Singles');
    expect(result.roundName).toBe('R16');
    expect(result.matchUpType).toBe('SINGLES');
    expect(result.gender).toBe('MALE');
    expect(result.flight).toBe('Main');
  });

  it('maps schedule fields', () => {
    let result: any = mapMatchUp(makeMatchUp());
    expect(result.scheduledDate).toBe('2025-03-24');
    expect(result.scheduledTime).toBe('10:00');
    expect(result.courtName).toBe('Court 1');
    expect(result.startTime).toBe('10:05');
    expect(result.endTime).toBe('11:30');
  });

  it('handles missing schedule gracefully', () => {
    let result: any = mapMatchUp(makeMatchUp({ schedule: undefined }));
    expect(result.scheduledDate).toBeUndefined();
    expect(result.scheduledTime).toBeUndefined();
  });

  it('maps side participants', () => {
    let result: any = mapMatchUp(makeMatchUp());
    expect(result.side1.participantName).toBe('Smith, John');
    expect(result.side2.participantName).toBe('Doe, Jane');
  });

  it('maps winning side', () => {
    let result: any = mapMatchUp(makeMatchUp({ winningSide: 1 }));
    expect(result.winningSide).toBe('side1');
    expect(result.complete).toBe(true);
  });

  it('returns undefined winningSide when no winner', () => {
    let result: any = mapMatchUp(makeMatchUp());
    expect(result.winningSide).toBeUndefined();
    expect(result.complete).toBe(false);
  });

  it('builds searchText from participant names', () => {
    let result: any = mapMatchUp(makeMatchUp());
    expect(result.searchText).toContain('smith');
    expect(result.searchText).toContain('doe');
  });

  it('uses TEAM eventType for collection matchUps', () => {
    let result: any = mapMatchUp(makeMatchUp({ collectionId: 'c1' }));
    expect(result.eventType).toBe('TEAM');
  });

  it('resolves official name from participantId', () => {
    let result: any = mapMatchUp(makeMatchUp({ schedule: { official: 'off1' } }));
    expect(result.official).toBe('Ref Jones');
  });

  it('uses potentialParticipants as fallback when sides have no participant', () => {
    let result: any = mapMatchUp(
      makeMatchUp({
        sides: [{}, {}],
        potentialParticipants: [
          [{ participantName: 'Potential A' }],
          [{ participantName: 'Potential B' }],
        ],
      }),
    );
    expect(result.side1.participantName).toBe('Potential A');
    expect(result.side2.participantName).toBe('Potential B');
  });
});
