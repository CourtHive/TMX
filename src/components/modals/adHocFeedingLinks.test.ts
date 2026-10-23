/**
 * An AD_HOC structure fed by a round robin's finishers must find that link whether it is labelled POSITION or WINNER,
 * with or without a source.roundNumber (CA, 2026-10-23); a link it misses leaves the target with no linked
 * participants.
 */
import { findAdHocFeedingLinks } from './adHocFeedingLinks';
import { describe, expect, it } from 'vitest';

type Shape = { linkType: string; roundNumber?: number };

const SHAPES: Shape[] = [
  { linkType: 'POSITION' },
  { linkType: 'POSITION', roundNumber: 3 },
  { linkType: 'WINNER' },
  { linkType: 'WINNER', roundNumber: 3 },
];

const structures = [
  { structureId: 'rr', structureType: 'CONTAINER', structures: [{ structureId: 'g1' }, { structureId: 'g2' }] },
  { structureId: 'se', matchUps: [] },
  { structureId: 'adhoc', matchUps: [] },
  { structureId: 'other', matchUps: [] },
];

const link = (linkType: string, sourceStructureId: string, source: any = {}, target = 'adhoc') => ({
  linkType,
  source: { structureId: sourceStructureId, ...source },
  target: { structureId: target, roundNumber: 1 },
});

describe('findAdHocFeedingLinks', () => {
  it.each(SHAPES)(
    'finds a round robin finishing-position link: $linkType $roundNumber',
    ({ linkType, roundNumber }) => {
      const rrLink = link(linkType, 'rr', { finishingPositions: [1], ...(roundNumber && { roundNumber }) });
      const drawDefinition = { structures, links: [rrLink] };
      const { loserLinks, positionLink } = findAdHocFeedingLinks(drawDefinition, 'adhoc');
      expect(positionLink).toBe(rrLink);
      expect(loserLinks).toEqual([]);
    },
  );

  it('ignores a finishing-position link into another structure', () => {
    const drawDefinition = { structures, links: [link('WINNER', 'rr', { finishingPositions: [1] }, 'other')] };
    expect(findAdHocFeedingLinks(drawDefinition, 'adhoc').positionLink).toBeUndefined();
  });

  it('a WINNER link out of an elimination structure is a round link, not a feeding finishing-position link', () => {
    const drawDefinition = { structures, links: [link('WINNER', 'se', { roundNumber: 2, finishingPositions: [1] })] };
    expect(findAdHocFeedingLinks(drawDefinition, 'adhoc').positionLink).toBeUndefined();
  });

  it('a round robin WINNER link naming no finishingPositions is not a finishing-position link', () => {
    const drawDefinition = { structures, links: [link('WINNER', 'rr', { roundNumber: 3 })] };
    expect(findAdHocFeedingLinks(drawDefinition, 'adhoc').positionLink).toBeUndefined();
  });

  it('without the draw a WINNER link reads as a round link', () => {
    const rrLink = link('WINNER', 'rr', { finishingPositions: [1] });
    expect(findAdHocFeedingLinks({ links: [rrLink] }, 'adhoc').positionLink).toBeUndefined();
  });

  it('collects LOSER links into the target, never as finishing-position links', () => {
    const loser = link('LOSER', 'rr', { roundNumber: 1, finishingPositions: [1] });
    const { loserLinks, positionLink } = findAdHocFeedingLinks({ structures, links: [loser] }, 'adhoc');
    expect(loserLinks).toEqual([loser]);
    expect(positionLink).toBeUndefined();
  });
});
