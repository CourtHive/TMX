import { designForFlight, shareOut } from './topologyFlightDesign';
import { describe, expect, it } from 'vitest';

const at = { x: 0, y: 0 };
const main = (drawSize: number, structureType = 'SINGLE_ELIMINATION', structureOptions?: any) => ({
  id: 'main',
  structureName: 'Main',
  stage: 'MAIN',
  structureType,
  drawSize,
  structureOptions,
  position: at,
});
const qualifying = (id: string, drawSize: number, qualifyingPositions: number) => ({
  id,
  structureName: id,
  stage: 'QUALIFYING',
  structureType: 'SINGLE_ELIMINATION',
  drawSize,
  qualifyingPositions,
  position: at,
});
const winner = (sourceNodeId: string, targetNodeId: string, targetRoundNumber = 1) => ({
  id: `${sourceNodeId}-${targetNodeId}`,
  sourceNodeId,
  targetNodeId,
  linkType: 'WINNER',
  targetRoundNumber,
});

/** A flight's entries: `main` accepted in MAIN, `qualifying` accepted in QUALIFYING, and an alternate that never counts. */
function flight(drawName: string, main: number, qualifying = 0) {
  const entry = (i: number, entryStage: string, entryStatus = 'DIRECT_ACCEPTANCE') => ({
    participantId: `${entryStage}-${i}`,
    entryStage,
    entryStatus,
  });
  return {
    drawId: drawName,
    drawName,
    drawEntries: [
      ...Array.from({ length: main }, (_, i) => entry(i, 'MAIN')),
      ...Array.from({ length: qualifying }, (_, i) => entry(i, 'QUALIFYING')),
      entry(99, 'MAIN', 'ALTERNATE'),
    ],
  };
}

const sizes = (draft: any) =>
  Object.fromEntries(draft.nodes.map((n: any) => [n.id, [n.drawSize, n.qualifyingPositions]]));

describe('one design for the other flights (CA, 2026-11-18)', () => {
  it('a single Main is sized to the flight: the next power of two, alternates not counted', () => {
    const draft = designForFlight(
      { drawName: 'Flight 1', nodes: [main(32)], edges: [] } as any,
      flight('Flight 2', 12),
    );
    expect(sizes(draft)).toEqual({ main: [16, undefined] });
    expect(draft.drawName).toBe('Flight 2');
  });

  it('a feed-in Main takes its count, and its feed rounds profile (the design size) goes', () => {
    const design = { nodes: [main(48, 'FEED_IN', { feedRoundsProfile: [8, 8] })], edges: [] } as any;
    const draft = designForFlight(design, flight('Flight 2', 20));
    expect(sizes(draft)).toEqual({ main: [20, undefined] });
    expect(draft.nodes![0].structureOptions).toBeUndefined();
  });

  it('a Main and a qualifying card: the qualifying holds the flight qualifying entries, Main its own and the qualifiers', () => {
    const design = { nodes: [main(32), qualifying('Q', 16, 4)], edges: [winner('Q', 'main')] } as any;
    expect(sizes(designForFlight(design, flight('Flight 2', 10, 12)))).toEqual({ main: [16, undefined], Q: [12, 4] });
    // a smaller qualifying field: its qualifiers come down to half of it
    expect(sizes(designForFlight(design, flight('Flight 3', 10, 6)))).toEqual({ main: [16, undefined], Q: [6, 3] });
  });

  it('two qualifying fields share the flight qualifying entries as the design shares them', () => {
    // the design: a stronger 16 → R3, a weaker 32 → R1 (a third and two thirds)
    const design = {
      nodes: [main(48, 'FEED_IN'), qualifying('Stronger', 16, 8), qualifying('Weaker', 32, 8)],
      edges: [winner('Stronger', 'main', 3), winner('Weaker', 'main')],
    } as any;
    const draft = designForFlight(design, flight('Flight 2', 12, 24));
    // the stronger 8 qualifies 4 (half of it): MAIN is 12 + 4 + 8
    expect(sizes(draft)).toEqual({ main: [24, undefined], Stronger: [8, 4], Weaker: [16, 8] });
  });

  it('a pre-qualifying chain: the pre-qualifying is sized first, the qualifying holds its share and those qualifiers', () => {
    // qualifying 24 = 16 of its own + 8 from a pre-qualifying 32: the bands are 16 and 32
    const design = {
      nodes: [main(32), qualifying('Q', 24, 8), qualifying('Pre', 32, 8)],
      edges: [winner('Pre', 'Q'), winner('Q', 'main')],
    } as any;
    const draft = designForFlight(design, flight('Flight 2', 8, 24));
    // 24 shared 16:32 is 8 and 16; the pre-qualifying 16 keeps 8 qualifiers, so the qualifying is 8 + 8
    expect(sizes(draft)).toEqual({ main: [16, undefined], Q: [16, 8], Pre: [16, 8] });
  });

  it('shares whole numbers that add up, largest remainders first', () => {
    expect(shareOut(24, [16, 32])).toEqual([8, 16]);
    expect(shareOut(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(shareOut(5, [0, 0])).toEqual([0, 0]);
  });
});
