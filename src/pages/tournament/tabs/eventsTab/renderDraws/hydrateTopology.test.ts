/**
 * A link out of a round robin is directed by its finishingPositions whether it is labelled POSITION or WINNER, and its
 * source.roundNumber decides nothing (CA, 2026-10-23). Classic TMX conversions carry WINNER. Every shape of the same
 * link must hydrate as the same POSITION edge, with the same qualifyingPositions on its qualifying node.
 */
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { hydrateTopology } from './hydrateTopology';
import { describe, expect, it } from 'vitest';

type Shape = { linkType: string; roundNumber?: number };

const SHAPES: Shape[] = [
  { linkType: 'POSITION' },
  { linkType: 'POSITION', roundNumber: 3 },
  { linkType: 'WINNER' },
  { linkType: 'WINNER', roundNumber: 3 },
];
const shapeName = ({ linkType, roundNumber }: Shape) => (roundNumber ? `${linkType} + roundNumber` : linkType);

function generateDraw(drawProfile: any): any {
  const result: any = mocksEngine.generateTournamentRecord({ setState: true, drawProfiles: [drawProfile] });
  return tournamentEngine.getEvent({ drawId: result.drawIds[0] }).drawDefinition;
}

/** the same draw with every link relabelled and its source.roundNumber set or removed */
function reshape(drawDefinition: any, { linkType, roundNumber }: Shape): any {
  const clone = structuredClone(drawDefinition);
  for (const link of clone.links) {
    link.linkType = linkType;
    if (roundNumber) link.source.roundNumber = roundNumber;
    else delete link.source.roundNumber;
  }
  return clone;
}

const rrQualifying = generateDraw({
  drawSize: 32,
  qualifyingProfiles: [
    {
      roundTarget: 1,
      structureProfiles: [{ drawSize: 16, drawType: 'ROUND_ROBIN', structureOptions: { groupSize: 4 } }],
    },
  ],
});
const rrPlayoff = generateDraw({ drawSize: 16, drawType: 'ROUND_ROBIN_WITH_PLAYOFF' });
const seQualifying = generateDraw({
  drawSize: 32,
  qualifyingProfiles: [{ roundTarget: 1, structureProfiles: [{ drawSize: 16, qualifyingPositions: 4 }] }],
});

describe('fixtures are what the factory writes', () => {
  it('a round robin qualifying link is POSITION with a roundNumber, out of 4 groups', () => {
    const [link] = rrQualifying.links;
    expect(link.linkType).toBe('POSITION');
    expect(link.source.roundNumber).toBe(3);
    expect(link.source.finishingPositions).toEqual([1]);
    const source = rrQualifying.structures.find((s: any) => s.structureId === link.source.structureId);
    expect(source.structureType).toBe('CONTAINER');
    expect(source.structures).toHaveLength(4);
  });

  it('an elimination qualifying link is a WINNER round link', () => {
    const [link] = seQualifying.links;
    expect(link.linkType).toBe('WINNER');
    expect(link.source.roundNumber).toBe(2);
  });
});

describe('hydrateTopology: a round robin qualifying link, every shape', () => {
  const hydrated = SHAPES.map((shape) => ({ shape, state: hydrateTopology(reshape(rrQualifying, shape))! }));

  it.each(hydrated)(
    'hydrates as a POSITION edge with 4 qualifiers: $shape.linkType $shape.roundNumber',
    ({ state }) => {
      const [edge] = state.edges!;
      expect(edge.linkType).toBe('POSITION');
      expect(edge.finishingPositions).toEqual([1]);
      expect(edge.sourceRoundNumber).toBeUndefined();
      expect(edge.targetRoundNumber).toBe(1);
      expect(edge.label).toBe('positions 1 → R1');

      const qualifying = state.nodes!.find((n) => n.stage === 'QUALIFYING')!;
      expect(qualifying.structureType).toBe('ROUND_ROBIN');
      expect(qualifying.drawSize).toBe(16);
      expect(qualifying.structureOptions).toEqual({ groupSize: 4 });
      expect(qualifying.qualifyingPositions).toBe(4);
    },
  );

  it('every shape hydrates identically', () => {
    for (const { shape, state } of hydrated) expect(state, shapeName(shape)).toEqual(hydrated[0].state);
  });

  it('two finishing positions per group carry 8 qualifiers', () => {
    const draw = reshape(rrQualifying, { linkType: 'WINNER', roundNumber: 3 });
    draw.links[0].source.finishingPositions = [1, 2];
    const qualifying = hydrateTopology(draw)!.nodes!.find((n) => n.stage === 'QUALIFYING')!;
    expect(qualifying.qualifyingPositions).toBe(8);
  });
});

describe('hydrateTopology: a round robin playoff link, every shape', () => {
  const hydrated = SHAPES.map((shape) => ({ shape, state: hydrateTopology(reshape(rrPlayoff, shape))! }));

  it.each(hydrated)('hydrates as a POSITION edge: $shape.linkType $shape.roundNumber', ({ state }) => {
    const [edge] = state.edges!;
    expect(edge.linkType).toBe('POSITION');
    expect(edge.finishingPositions).toEqual([1]);
    expect(edge.sourceRoundNumber).toBeUndefined();
    const main = state.nodes!.find((n) => n.stage === 'MAIN')!;
    expect(main.structureType).toBe('ROUND_ROBIN');
    expect(main.drawSize).toBe(16);
  });

  it('every shape hydrates identically', () => {
    for (const { shape, state } of hydrated) expect(state, shapeName(shape)).toEqual(hydrated[0].state);
  });
});

describe('hydrateTopology: links that are not finishing-position links', () => {
  it('a WINNER link out of an elimination structure is still a round link', () => {
    const state = hydrateTopology(seQualifying)!;
    const [edge] = state.edges!;
    expect(edge.linkType).toBe('WINNER');
    expect(edge.sourceRoundNumber).toBe(2);
    expect(edge.label).toBe('R2 winner → R1');
    const qualifying = state.nodes!.find((n) => n.stage === 'QUALIFYING')!;
    expect(qualifying.structureType).toBe('SINGLE_ELIMINATION');
    expect(qualifying.qualifyingPositions).toBe(4);
  });

  it('a round robin WINNER link naming no finishingPositions is not a finishing-position link', () => {
    const draw = reshape(rrQualifying, { linkType: 'WINNER', roundNumber: 3 });
    delete draw.links[0].source.finishingPositions;
    const state = hydrateTopology(draw)!;
    const [edge] = state.edges!;
    expect(edge.linkType).toBe('WINNER');
    expect(edge.sourceRoundNumber).toBe(3);
    expect(edge.finishingPositions).toBeUndefined();
  });

  it('a LOSER link out of a round robin is never a finishing-position link', () => {
    const [edge] = hydrateTopology(reshape(rrQualifying, { linkType: 'LOSER', roundNumber: 3 }))!.edges!;
    expect(edge.linkType).toBe('LOSER');
    expect(edge.sourceRoundNumber).toBe(3);
  });
});

describe('hydrateTopology: a voluntary consolation is its own stage (2026-11-08)', () => {
  it('not a second MAIN card, and no invented positions while nobody has opted in', () => {
    const drawDefinition = generateDraw({ drawSize: 16 });
    const { drawId } = drawDefinition;
    const generated: any = tournamentEngine.generateVoluntaryConsolation({ drawId, structureName: 'Consolation' });
    const attached: any = tournamentEngine.attachConsolationStructures({
      drawId,
      structures: generated.structures,
      links: generated.links,
    });
    expect(attached.success).toBe(true);

    const state = hydrateTopology(tournamentEngine.getEvent({ drawId }).drawDefinition)!;
    expect(state.nodes!.map((node) => [node.structureName, node.stage, node.drawSize])).toEqual([
      ['Main', 'MAIN', 16],
      ['Consolation', 'VOLUNTARY_CONSOLATION', 0],
    ]);
  });
});

// A lucky draw generated with an explicit round profile carries it as the structure extension `customRoundProfile`;
// the topology must show that profile, not the default cascade (CA, 2026-11-08: round profiles in the topology).
describe('hydrateTopology — a lucky draw keeps its round profile', () => {
  it('reads customRoundProfile into the node structureOptions', () => {
    const drawDefinition = generateDraw({ drawSize: 40, drawType: 'LUCKY_DRAW', roundProfile: [20, 12, 8, 4, 2, 1] });
    const node: any = hydrateTopology(drawDefinition)?.nodes?.find((n: any) => n.structureType === 'LUCKY_DRAW');
    expect(node?.structureOptions?.roundProfile).toEqual([20, 12, 8, 4, 2, 1]);
  });

  it('leaves a default-cascade lucky draw without one', () => {
    const drawDefinition = generateDraw({ drawSize: 40, drawType: 'LUCKY_DRAW' });
    const node: any = hydrateTopology(drawDefinition)?.nodes?.find((n: any) => n.structureType === 'LUCKY_DRAW');
    expect(node).toBeTruthy();
    expect(node.structureOptions?.roundProfile).toBeUndefined();
  });
});
