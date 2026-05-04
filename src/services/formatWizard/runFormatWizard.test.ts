import { runFormatWizard } from './runFormatWizard';
import { expect, it, describe } from 'vitest';

// constants and types
import { WizardConstraints } from 'tods-competition-factory';

const baseConstraints: WizardConstraints = {
  courts: 4,
  days: 2,
  hoursPerDay: 8,
  targetMatchesPerPlayer: 3,
  consolationAppetite: 'LIGHT',
};

function poolWithRatings(values: Array<number | undefined>) {
  return values.map((rating, i) => ({
    participantId: `p${i}`,
    person: { sex: 'MALE' },
    ratings:
      rating === undefined
        ? {}
        : { SINGLES: [{ scaleName: 'UTR', scaleValue: { utrRating: rating }, scaleDate: '2026-05-04' }] },
  }));
}

describe('runFormatWizard — input validation', () => {
  it('returns INVALID_CONSTRAINTS when constraints are missing or malformed', () => {
    const result = runFormatWizard({
      constraints: { courts: 4 } as WizardConstraints,
      scaleName: 'utr',
      participantsOverride: [],
    });
    expect(result.error).toEqual('INVALID_CONSTRAINTS');
    expect(result.plans).toEqual([]);
  });

  it('returns MISSING_SCALE when scaleName is empty', () => {
    const result = runFormatWizard({
      constraints: baseConstraints,
      scaleName: '',
      participantsOverride: [],
    });
    expect(result.error).toEqual('MISSING_SCALE');
  });

  it('returns INSUFFICIENT_RATED_PARTICIPANTS when fewer than 2 rated participants', () => {
    const result = runFormatWizard({
      constraints: baseConstraints,
      scaleName: 'utr',
      participantsOverride: poolWithRatings([5, undefined, undefined]),
    });
    expect(result.error).toEqual('INSUFFICIENT_RATED_PARTICIPANTS');
    expect(result.totalParticipants).toEqual(3);
    expect(result.ratedParticipants).toEqual(1);
    expect(result.excludedParticipantIds).toEqual(['p1', 'p2']);
  });
});

describe('runFormatWizard — engine bridge', () => {
  it('returns a populated plans list and distribution for a healthy pool', () => {
    const participants = poolWithRatings([4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5]);
    const result = runFormatWizard({
      constraints: baseConstraints,
      scaleName: 'utr',
      participantsOverride: participants,
    });
    expect(result.error).toBeUndefined();
    expect(result.plans.length).toBeGreaterThan(0);
    expect(result.distribution.count).toEqual(8);
    expect(result.appliedScale).toEqual('utr');
    expect(result.totalParticipants).toEqual(8);
    expect(result.ratedParticipants).toEqual(8);
    expect(result.excludedParticipantIds).toEqual([]);
  });

  it('reports both totalParticipants and ratedParticipants when the pool is mixed', () => {
    const participants = poolWithRatings([4, 4.5, undefined, 5, 5.5, undefined, 6, 6.5]);
    const result = runFormatWizard({
      constraints: baseConstraints,
      scaleName: 'utr',
      participantsOverride: participants,
    });
    expect(result.totalParticipants).toEqual(8);
    expect(result.ratedParticipants).toEqual(6);
    expect(result.excludedParticipantIds).toEqual(['p2', 'p5']);
    expect(result.plans.length).toBeGreaterThan(0);
  });

  it('passes governance caps through to the engine', () => {
    const participants = poolWithRatings([4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5]);
    const result = runFormatWizard({
      constraints: baseConstraints,
      governance: { allowedDrawTypes: ['ROUND_ROBIN'] },
      scaleName: 'utr',
      participantsOverride: participants,
    });
    expect(result.error).toBeUndefined();
    for (const plan of result.plans) {
      for (const fs of plan.flightStructures) {
        expect(fs.structure.kind).toEqual('ROUND_ROBIN');
      }
    }
  });
});
