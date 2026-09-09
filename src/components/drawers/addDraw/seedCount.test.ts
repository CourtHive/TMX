import { describe, expect, it } from 'vitest';

import { getSeedCountChoices, resolveSeedsCount } from './seedCount';

describe('getSeedCountChoices', () => {
  it('offers an explicit eight seeds for a 32-position draw', () => {
    expect(getSeedCountChoices({ drawSize: 32, participantsCount: 20 })).toEqual([0, 2, 4, 8]);
  });

  it('does not offer more seeds than there are participants', () => {
    expect(getSeedCountChoices({ drawSize: 32, participantsCount: 6 })).toEqual([0, 2, 4]);
  });

  it('uses the next power-of-two capacity for non-power-of-two draws', () => {
    expect(getSeedCountChoices({ drawSize: 24, participantsCount: 24 })).toEqual([0, 2, 4, 8]);
  });
});

describe('resolveSeedsCount', () => {
  it('preserves policy-driven behavior when Automatic is selected', () => {
    expect(
      resolveSeedsCount({ requestedValue: '', automaticSeedsCount: 4, drawSize: 32, participantsCount: 20 }),
    ).toEqual({ seedsCount: 4, valid: true });
  });

  it('accepts a supported explicit override', () => {
    expect(
      resolveSeedsCount({ requestedValue: '8', automaticSeedsCount: 4, drawSize: 32, participantsCount: 20 }),
    ).toEqual({ seedsCount: 8, valid: true });
  });

  it('rejects an override that exceeds the available participants', () => {
    expect(
      resolveSeedsCount({ requestedValue: '8', automaticSeedsCount: 4, drawSize: 32, participantsCount: 6 }),
    ).toEqual({ valid: false });
  });
});
