import { resolveSideDrawPosition } from './resolveSideDrawPosition';
import { describe, expect, it } from 'vitest';

/**
 * The index fallback this replaced — `matchUp.drawPositions?.[sideNumber - 1]` — is wrong exactly
 * when it fires, because `drawPositions` is COMPACTED for a matchUp holding one position. The shapes
 * below are the ones the factory actually produces around a propagated exit.
 */
describe('resolveSideDrawPosition', () => {
  const sides = [
    { sideNumber: 1, drawPosition: 3 },
    { sideNumber: 2, drawPosition: 4 },
  ];

  it('resolves by sideNumber', () => {
    expect(resolveSideDrawPosition({ matchUp: { sides }, sideNumber: 2 })).toEqual({
      drawPosition: 4,
      unresolved: false,
    });
  });

  it('prefers a side handed in by the caller', () => {
    const side = { sideNumber: 2, drawPosition: 9 };
    expect(resolveSideDrawPosition({ matchUp: { sides }, sideNumber: 2, side }).drawPosition).toEqual(9);
  });

  it('a side with no drawPosition yet resolves to undefined, not to the other side position', () => {
    // a produced exit waiting for its opponent: drawPositions is compacted to [4], and the old
    // fallback would have answered drawPositions[1] === undefined for side 2 and, worse, handed
    // side 2 the value 4 whenever the array happened to hold two entries
    const inFlight = {
      drawPositions: [4],
      sides: [{ sideNumber: 1, drawPosition: 4 }, { sideNumber: 2 }],
    };
    expect(resolveSideDrawPosition({ matchUp: inFlight, sideNumber: 2 })).toEqual({
      drawPosition: undefined,
      unresolved: false,
    });
  });

  it('an empty future-round side resolves to nothing, quietly', () => {
    // getEventData returns these for rounds nobody has reached: sides are empty objects and the
    // matchUp carries no drawPositions at all. Measured: 3 of 7 matchUps in an 8 draw.
    const futureRound = { sides: [{}, {}] };
    expect(resolveSideDrawPosition({ matchUp: futureRound, sideNumber: 2 })).toEqual({
      drawPosition: undefined,
      unresolved: false,
    });
  });

  it('reports unresolved only when there is no side there at all', () => {
    expect(resolveSideDrawPosition({ matchUp: { sides: [] }, sideNumber: 1 }).unresolved).toEqual(true);
    expect(resolveSideDrawPosition({ matchUp: undefined, sideNumber: 1 }).unresolved).toEqual(true);
    // an unparsable sideNumber names no ordinal either
    expect(resolveSideDrawPosition({ matchUp: { sides }, sideNumber: NaN }).unresolved).toEqual(true);
  });

  it('prefers the side that names itself over the one at that ordinal', () => {
    // the array is reversed: ordinal 1 holds sideNumber 2
    const reversed = [
      { sideNumber: 2, drawPosition: 4 },
      { sideNumber: 1, drawPosition: 3 },
    ];
    expect(resolveSideDrawPosition({ matchUp: { sides: reversed }, sideNumber: 1 }).drawPosition).toEqual(3);
  });

  it('CONTROL — never consults drawPositions, whatever the array holds', () => {
    // the array disagrees with the sides on purpose; the sides win
    const disagreeing = {
      drawPositions: [7, 8],
      sides: [
        { sideNumber: 1, drawPosition: 3 },
        { sideNumber: 2, drawPosition: 4 },
      ],
    };
    expect(resolveSideDrawPosition({ matchUp: disagreeing, sideNumber: 1 }).drawPosition).toEqual(3);
    expect(resolveSideDrawPosition({ matchUp: disagreeing, sideNumber: 2 }).drawPosition).toEqual(4);
  });
});
