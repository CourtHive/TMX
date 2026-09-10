import { getSeedCountChoices, isSeedableDrawType, resolveSeedsCount } from './seedCount';
import { drawDefinitionConstants } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

import { DRAW_MATIC } from 'constants/tmxConstants';

const { AD_HOC, ADAPTIVE, LUCKY_DRAW, ROUND_ROBIN, SINGLE_ELIMINATION, SWISS } = drawDefinitionConstants;

describe('getSeedCountChoices', () => {
  it('offers up to half the positions, which the policy threshold alone would not reach', () => {
    // POLICY_SEEDING_DEFAULT tops out at 8 seeds for a 32 draw. 16 is the point of the override,
    // and the factory honors it when enforcePolicyLimits is false.
    expect(getSeedCountChoices({ drawSize: 32, participantsCount: 32 })).toEqual([0, 2, 4, 8, 16]);
  });

  it('does not offer more seeds than there are participants', () => {
    expect(getSeedCountChoices({ drawSize: 32, participantsCount: 6 })).toEqual([0, 2, 4]);
  });

  it('counts the positions a non-power-of-two structure actually has', () => {
    // 24 positions, so 12 is the half-way ceiling and 16 is out of reach.
    expect(getSeedCountChoices({ drawSize: 24, participantsCount: 24 })).toEqual([0, 2, 4, 8]);
  });

  it('offers multiples of the group count for a round robin', () => {
    // 15 in groups of 3 is 5 groups; one seed per group is 5, which no power-of-two list contains.
    expect(getSeedCountChoices({ drawType: ROUND_ROBIN, drawSize: 15, groupSize: 3, participantsCount: 15 })).toEqual([
      0, 5,
    ]);
  });

  it('offers a second seed per group when the positions allow', () => {
    expect(getSeedCountChoices({ drawType: ROUND_ROBIN, drawSize: 32, groupSize: 4, participantsCount: 32 })).toEqual([
      0, 8, 16,
    ]);
  });

  it('offers nothing for draw types the factory refuses to seed', () => {
    for (const drawType of [AD_HOC, ADAPTIVE, DRAW_MATIC, LUCKY_DRAW, SWISS]) {
      expect(getSeedCountChoices({ drawType, drawSize: 32, participantsCount: 32 })).toEqual([]);
    }
  });

  it('returns only the empty choice for a draw too small to seed', () => {
    expect(getSeedCountChoices({ drawSize: 2, participantsCount: 2 })).toEqual([0]);
  });
});

describe('isSeedableDrawType', () => {
  it('separates the draw types the factory will seed from the ones it zeroes', () => {
    expect(isSeedableDrawType(SINGLE_ELIMINATION)).toEqual(true);
    expect(isSeedableDrawType(ROUND_ROBIN)).toEqual(true);
    // LUCKY_DRAW and ADAPTIVE are not ad hoc, but generateNewDrawDefinition forces their
    // seedsCount to 0 — the reason this predicate is not just "is not ad hoc".
    expect(isSeedableDrawType(LUCKY_DRAW)).toEqual(false);
    expect(isSeedableDrawType(ADAPTIVE)).toEqual(false);
    expect(isSeedableDrawType(undefined)).toEqual(false);
  });
});

describe('resolveSeedsCount', () => {
  it('preserves policy-driven behavior when Automatic is selected', () => {
    expect(
      resolveSeedsCount({ requestedValue: '', automaticSeedsCount: 4, drawSize: 32, participantsCount: 20 }),
    ).toEqual({ seedsCount: 4, isOverride: false });
  });

  it('accepts a supported explicit override', () => {
    expect(
      resolveSeedsCount({ requestedValue: '16', automaticSeedsCount: 4, drawSize: 32, participantsCount: 32 }),
    ).toEqual({ seedsCount: 16, isOverride: true });
  });

  it('treats an explicit zero as an override, not as an absent value', () => {
    expect(
      resolveSeedsCount({ requestedValue: '0', automaticSeedsCount: 4, drawSize: 32, participantsCount: 20 }),
    ).toEqual({ seedsCount: 0, isOverride: true });
  });

  it('clamps an override that outruns the participants rather than refusing it', () => {
    // The option list can go stale between render and submit; the factory clamps here too.
    expect(
      resolveSeedsCount({ requestedValue: '8', automaticSeedsCount: 4, drawSize: 32, participantsCount: 6 }),
    ).toEqual({ seedsCount: 4, isOverride: true });
  });

  it('ignores a value left over from a draw type that cannot be seeded', () => {
    expect(
      resolveSeedsCount({
        requestedValue: '8',
        automaticSeedsCount: 4,
        drawType: LUCKY_DRAW,
        participantsCount: 32,
        drawSize: 32,
      }),
    ).toEqual({ seedsCount: 0, isOverride: false });
  });

  it('falls back to the policy count when the request is not a number', () => {
    expect(
      resolveSeedsCount({ requestedValue: 'eight', automaticSeedsCount: 4, drawSize: 32, participantsCount: 20 }),
    ).toEqual({ seedsCount: 4, isOverride: false });
  });
});
