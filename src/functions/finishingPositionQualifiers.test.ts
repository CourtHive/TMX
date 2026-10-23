import { finishingPositionQualifiers } from './finishingPositionQualifiers';
import { describe, expect, it } from 'vitest';

const container = { structureId: 'rr', structureType: 'CONTAINER', structures: [{}, {}, {}, {}] };
const elimination = { structureId: 'se', matchUps: [] };
const drawDefinition = { structures: [container, elimination] };

describe('finishingPositionQualifiers', () => {
  it.each(['POSITION', 'WINNER'])(
    '%s out of 4 groups at [1, 2] carries 8, with or without a roundNumber',
    (linkType) => {
      for (const roundNumber of [undefined, 3]) {
        const link = { linkType, source: { structureId: 'rr', finishingPositions: [1, 2], roundNumber } };
        expect(finishingPositionQualifiers(link, drawDefinition)).toBe(8);
      }
    },
  );

  it('a WINNER round link out of an elimination structure is not counted here', () => {
    const link = { linkType: 'WINNER', source: { structureId: 'se', roundNumber: 2, finishingPositions: [1] } };
    expect(finishingPositionQualifiers(link, drawDefinition)).toBeUndefined();
  });

  it('a round robin WINNER link naming no finishingPositions is not counted', () => {
    const link = { linkType: 'WINNER', source: { structureId: 'rr', roundNumber: 3 } };
    expect(finishingPositionQualifiers(link, drawDefinition)).toBeUndefined();
  });

  it('a POSITION link whose source has no groups is not counted', () => {
    const link = { linkType: 'POSITION', source: { structureId: 'se', finishingPositions: [1] } };
    expect(finishingPositionQualifiers(link, drawDefinition)).toBeUndefined();
  });
});
