import {
  buildSeedCountOptions,
  getAdditionalSeedCountChoices,
  getSeedCountChoices,
  isSeedableDrawType,
  resolveSeedsCount,
} from './seedCount';
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
    ).toEqual({ seedsCount: 4, isAdditional: false, isOverride: false });
  });

  it('accepts a supported explicit override', () => {
    expect(
      resolveSeedsCount({ requestedValue: '16', automaticSeedsCount: 4, drawSize: 32, participantsCount: 32 }),
    ).toEqual({ seedsCount: 16, isAdditional: false, isOverride: true });
  });

  it('treats an explicit zero as a value, not as an absent one', () => {
    // It is NOT an override. `isOverride` means "above the policy's ceiling", and nothing is above
    // a ceiling by asking for none — the factory clamps DOWN, so seedsCount 0 is delivered whether
    // or not policy limits are enforced. Measured against the factory both ways: seedLimit 0, no
    // assignments, identical. Reporting it as an override disabled a guard to no effect.
    expect(
      resolveSeedsCount({ requestedValue: '0', automaticSeedsCount: 4, drawSize: 32, participantsCount: 20 }),
    ).toEqual({ seedsCount: 0, isAdditional: false, isOverride: false });
  });

  it('clamps an override that outruns the participants rather than refusing it', () => {
    // The option list can go stale between render and submit; the factory clamps here too.
    expect(
      resolveSeedsCount({ requestedValue: '8', automaticSeedsCount: 4, drawSize: 32, participantsCount: 6 }),
    ).toEqual({ seedsCount: 4, isAdditional: false, isOverride: true });
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
    ).toEqual({ seedsCount: 0, isAdditional: false, isOverride: false });
  });

  it('falls back to the policy count when the request is not a number', () => {
    expect(
      resolveSeedsCount({ requestedValue: 'eight', automaticSeedsCount: 4, drawSize: 32, participantsCount: 20 }),
    ).toEqual({ seedsCount: 4, isAdditional: false, isOverride: false });
  });

  it('a count the policy permits is additional, NOT an override', () => {
    // The distinction the whole feature turns on. 9 seeds where the threshold is 8 and the policy
    // allows 2 more is the policy being HONOURED — so `submitDrawParams` must leave
    // enforcePolicyLimits alone. Lifting the ceiling to obtain a seat the ceiling already grants
    // would remove the bound the allowance exists to impose.
    expect(
      resolveSeedsCount({
        additionalSeedsAllowed: 2,
        thresholdSeedsCount: 8,
        automaticSeedsCount: 8,
        participantsCount: 32,
        requestedValue: '9',
        drawSize: 32,
      }),
    ).toEqual({ seedsCount: 9, isAdditional: true, isOverride: false });
  });

  it('a count above the allowance is still an override', () => {
    expect(
      resolveSeedsCount({
        additionalSeedsAllowed: 2,
        thresholdSeedsCount: 8,
        automaticSeedsCount: 8,
        participantsCount: 32,
        requestedValue: '16',
        drawSize: 32,
      }),
    ).toEqual({ seedsCount: 16, isAdditional: false, isOverride: true });
  });

  it('a count at or below the threshold is neither', () => {
    expect(
      resolveSeedsCount({
        additionalSeedsAllowed: 2,
        thresholdSeedsCount: 8,
        automaticSeedsCount: 8,
        participantsCount: 32,
        requestedValue: '4',
        drawSize: 32,
      }),
    ).toEqual({ seedsCount: 4, isAdditional: false, isOverride: false });
  });

  it('no longer snaps an additional count down to the nearest power of two', () => {
    // The blocker this change removes. Before the allowance existed, 9 was not on the list and
    // `resolveSeedsCount` floored it to 8 in silence — so a policy permitting 8 + 1 could not be
    // expressed at all, and the operator saw a draw that looked right.
    expect(
      resolveSeedsCount({
        additionalSeedsAllowed: 4,
        thresholdSeedsCount: 8,
        automaticSeedsCount: 8,
        participantsCount: 32,
        requestedValue: '12',
        drawSize: 32,
      }).seedsCount,
    ).toEqual(12);
  });
});

describe('getAdditionalSeedCountChoices', () => {
  it('offers the counts between the threshold and the allowance', () => {
    expect(
      getAdditionalSeedCountChoices({
        additionalSeedsAllowed: 3,
        thresholdSeedsCount: 8,
        participantsCount: 32,
        drawSize: 32,
      }),
    ).toEqual([9, 10, 11]);
  });

  it('offers nothing when the policy declares no allowance', () => {
    expect(getAdditionalSeedCountChoices({ thresholdSeedsCount: 8, participantsCount: 32, drawSize: 32 })).toEqual([]);
  });

  it('offers nothing when no threshold matched', () => {
    // An allowance is expressed relative to a count; with no count there is nothing to add to.
    expect(getAdditionalSeedCountChoices({ additionalSeedsAllowed: 3, participantsCount: 32, drawSize: 32 })).toEqual(
      [],
    );
  });

  it('respects the same structural ceilings as the ordinary choices', () => {
    // A 32-draw stops at 16, so an allowance of 12 above a threshold of 8 yields 9..16, not 9..20.
    expect(
      getAdditionalSeedCountChoices({
        additionalSeedsAllowed: 12,
        thresholdSeedsCount: 8,
        participantsCount: 32,
        drawSize: 32,
      }),
    ).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
  });

  it('will not seed more participants than entered', () => {
    expect(
      getAdditionalSeedCountChoices({
        additionalSeedsAllowed: 3,
        thresholdSeedsCount: 8,
        participantsCount: 9,
        drawSize: 32,
      }),
    ).toEqual([9]);
  });

  it('offers nothing for round robin', () => {
    // getSeedGroups distributes by group count rather than through power-of-two seed blocks, and
    // additional seeds are untested against that path — named as not-covered in the factory's own
    // documentation. Offering the control where the engine's behaviour is unverified is a guess.
    expect(
      getAdditionalSeedCountChoices({
        drawType: ROUND_ROBIN,
        additionalSeedsAllowed: 3,
        thresholdSeedsCount: 4,
        participantsCount: 15,
        groupSize: 3,
        drawSize: 15,
      }),
    ).toEqual([]);
  });

  it('offers nothing for a draw type that cannot be seeded', () => {
    expect(
      getAdditionalSeedCountChoices({
        drawType: LUCKY_DRAW,
        additionalSeedsAllowed: 3,
        thresholdSeedsCount: 8,
        participantsCount: 32,
        drawSize: 32,
      }),
    ).toEqual([]);
  });
});

describe('buildSeedCountOptions', () => {
  it('merges the additional counts into the list in ascending order', () => {
    // Appending them would list 9 and 10 after 16 — a dropdown that counts upwards and then jumps
    // backwards, in which the two entries that need to be noticed read as a mistake.
    const options = buildSeedCountOptions({
      additionalSeedsAllowed: 2,
      thresholdSeedsCount: 8,
      participantsCount: 32,
      drawSize: 32,
    });
    expect(options.map((option) => option.value)).toEqual(['', 0, 2, 4, 8, 9, 10, 16]);
  });

  it('labels only the additional counts', () => {
    const labels = Object.fromEntries(
      buildSeedCountOptions({
        additionalSeedsAllowed: 2,
        thresholdSeedsCount: 8,
        participantsCount: 32,
        drawSize: 32,
      }).map((option) => [String(option.value), option.label]),
    );
    expect(labels['8']).toEqual('8');
    expect(labels['9']).toEqual('9 (+1 additional seed)');
    expect(labels['10']).toEqual('10 (+2 additional seeds)');
    expect(labels['16']).toEqual('16');
  });

  it('is unchanged where the policy declares no allowance', () => {
    const options = buildSeedCountOptions({ thresholdSeedsCount: 8, participantsCount: 32, drawSize: 32 });
    expect(options.map((option) => option.label)).toEqual(['Automatic (policy)', 'None', '2', '4', '8', '16']);
  });
});
