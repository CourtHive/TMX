import { describe, expect, it, vi } from 'vitest';

// The engine is only reached by the DOM shell; the pure core is handed its
// matchUps. Mocked so importing the module does not pull in engine state.
vi.mock('services/factory/engine', () => ({ tournamentEngine: { getParticipants: () => ({ matchUps: [] }) } }));
vi.mock('i18n', () => ({ t: (key: string) => key }));
vi.mock('courthive-components', () => ({ buildSegmentedBar: () => ({ element: {}, update: () => {} }) }));

import { fingerprintData, displayBandKeys, resolveScaleName } from './participantFingerprint';
import { fixtures } from 'tods-competition-factory';

const { POLICY_COMPETITIVE_BANDS_DEFAULT } = fixtures.policies;

// WTN: range [40, 1] so magnitude 39, ascending (LOWER is stronger). The default
// policy's maxPct boundaries therefore resolve to +/-0.507 and +/-4.017.
const wtn = (participantId: string, wtnRating?: number) => ({
  participantId,
  ...(wtnRating === undefined ? {} : { ratings: { SINGLES: [{ scaleName: 'WTN', scaleValue: { wtnRating } }] } }),
});

const matchUp = ({ own = 20, opp, winningSide, sets }: any) => ({
  matchUpType: 'SINGLES',
  ...(winningSide ? { winningSide } : {}),
  score: { sets },
  sides: [
    { sideNumber: 1, participant: wtn('p1', own) },
    { sideNumber: 2, participant: wtn(`o-${opp ?? 'x'}`, opp) },
  ],
});

const DECISIVE_SETS = [
  { side1Score: 6, side2Score: 0 },
  { side1Score: 6, side2Score: 0 },
];
const COMPETITIVE_SETS = [
  { side1Score: 6, side2Score: 4 },
  { side1Score: 6, side2Score: 3 },
];

describe('resolveScaleName', () => {
  it('picks a scale the factory can orient', () => {
    expect(resolveScaleName(wtn('p1', 20))).toEqual('WTN');
  });

  it('skips a scale absent from ratingsParameters rather than guessing orientation', () => {
    const participant = {
      participantId: 'p1',
      ratings: { SINGLES: [{ scaleName: 'HOUSE_LADDER', scaleValue: 10 }] },
    };
    expect(resolveScaleName(participant)).toBeUndefined();
  });

  it('returns undefined when the participant carries no ratings', () => {
    expect(resolveScaleName(wtn('p1'))).toBeUndefined();
    expect(resolveScaleName(undefined)).toBeUndefined();
  });
});

describe('displayBandKeys', () => {
  it('reads the five default keys, widest stretch first', () => {
    expect(displayBandKeys(POLICY_COMPETITIVE_BANDS_DEFAULT)).toEqual(['STRETCH', 'UP', 'EVEN', 'DOWN', 'ANCHOR']);
  });

  it('follows a policy that declares a different vocabulary and count', () => {
    const custom = {
      competitiveBands: {
        deltaBands: [{ key: 'EASIER', max: -2 }, { key: 'LEVEL', max: 2 }, { key: 'HARDER' }],
      },
    };
    // Band count and names come from policy — nothing here is hardcoded.
    expect(displayBandKeys(custom)).toEqual(['HARDER', 'LEVEL', 'EASIER']);
  });

  it('returns nothing when a policy declares no deltaBands', () => {
    expect(displayBandKeys({ competitiveBands: { profileBands: { DECISIVE: 20, ROUTINE: 50 } } })).toEqual([]);
  });
});

describe('fingerprintData', () => {
  const participant = wtn('p1', 20);

  it('bands both axes with exact counts', () => {
    const matchUps = [
      matchUp({ opp: 25, winningSide: 1, sets: DECISIVE_SETS }), // -5 => ANCHOR
      matchUp({ opp: 20, winningSide: 1, sets: COMPETITIVE_SETS }), // 0 => EVEN
      matchUp({ opp: 15, winningSide: 2, sets: COMPETITIVE_SETS }), // +5 => STRETCH
    ];

    const data: any = fingerprintData({ participantId: 'p1', participant, matchUps });

    expect(data.scaleName).toEqual('WTN');
    expect(data.exposure.counts).toEqual({ ANCHOR: 1, DOWN: 0, EVEN: 1, UP: 0, STRETCH: 1 });
    expect(data.exposure.rated).toEqual(3);
    expect(data.exposure.unrated).toEqual(0);
    // 6-0 6-0 is a 0% spread; 6-4 6-3 is 58%.
    expect(data.realized.counts).toEqual({ DECISIVE: 1, ROUTINE: 0, COMPETITIVE: 2 });
    expect(data.realized.completed).toEqual(3);
    expect(data.realized.ratios.COMPETITIVE).toBeCloseTo(66.67, 1);
  });

  it('counts an unrated opponent as unrated rather than banding it', () => {
    const matchUps = [
      matchUp({ opp: 25, winningSide: 1, sets: DECISIVE_SETS }),
      matchUp({ opp: undefined, winningSide: 1, sets: DECISIVE_SETS }),
    ];

    const data: any = fingerprintData({ participantId: 'p1', participant, matchUps });

    expect(data.exposure.rated).toEqual(1);
    expect(data.exposure.unrated).toEqual(1);
    // Both matches still count on the realized axis — a score needs no rating.
    expect(data.realized.completed).toEqual(2);
  });

  it('reports no bands when the policy declares no deltaBands, without inventing a default', () => {
    const data: any = fingerprintData({
      policyDefinitions: { competitiveBands: { profileBands: { DECISIVE: 20, ROUTINE: 50 } } },
      matchUps: [matchUp({ opp: 25, winningSide: 1, sets: DECISIVE_SETS })],
      participantId: 'p1',
      participant,
    });

    expect(data.exposure.deltaBandsApplied).toEqual(false);
    expect(data.exposure.counts).toEqual({});
    expect(data.bandKeys).toEqual([]);
    // The delta axis still resolved — only the labelling was withheld.
    expect(data.exposure.rated).toEqual(1);
  });

  it('still returns the realized axis when no rating scale resolves', () => {
    const unrated = wtn('p1');
    const data: any = fingerprintData({
      matchUps: [matchUp({ own: undefined, opp: undefined, winningSide: 1, sets: COMPETITIVE_SETS })],
      participantId: 'p1',
      participant: unrated,
    });

    expect(data.scaleName).toBeUndefined();
    expect(data.exposure.rated).toEqual(0);
    expect(data.realized.counts.COMPETITIVE).toEqual(1);
  });

  it('returns undefined when there are no matchUps at all', () => {
    expect(fingerprintData({ participantId: 'p1', participant, matchUps: [] })).toBeUndefined();
  });

  it('returns undefined when nothing is played and nothing is rated', () => {
    const scheduled = {
      matchUpType: 'SINGLES',
      score: { sets: [] },
      sides: [
        { sideNumber: 1, participant: wtn('p1') },
        { sideNumber: 2, participant: wtn('o1') },
      ],
    };
    expect(fingerprintData({ participantId: 'p1', participant: wtn('p1'), matchUps: [scheduled] })).toBeUndefined();
  });

  it('renders nothing rather than a wrong bar when the policy is invalid', () => {
    const broken = { competitiveBands: { deltaBands: [{ key: 'A', max: 1, maxPct: 10 }, { key: 'B' }] } };
    const data = fingerprintData({
      matchUps: [matchUp({ opp: 25, winningSide: 1, sets: DECISIVE_SETS })],
      policyDefinitions: broken,
      participantId: 'p1',
      participant,
    });
    expect(data).toBeUndefined();
  });

  it('inverts with perspective — the same matchUp reads opposite for the opponent', () => {
    const matchUps = [matchUp({ opp: 25, winningSide: 1, sets: DECISIVE_SETS })];

    const own: any = fingerprintData({ participantId: 'p1', participant, matchUps });
    const opponent: any = fingerprintData({
      participant: wtn('o-25', 25),
      participantId: 'o-25',
      matchUps,
    });

    expect(own.exposure.counts.ANCHOR).toEqual(1);
    expect(opponent.exposure.counts.STRETCH).toEqual(1);
  });
});
