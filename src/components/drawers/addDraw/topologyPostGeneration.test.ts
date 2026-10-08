import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The topology converter defers the structures the generator cannot produce in one call and names
 * each one's SOURCE node. Both TMX consumers used to attach every deferred consolation to the MAIN
 * structure — a consolation for the losers of qualifying round 1 came out fed by the main draw. This
 * pins the resolution and what the consumers hand to the engine.
 */
const mutationRequestMock = vi.fn();
vi.mock('services/mutation/mutationRequest', () => ({ mutationRequest: (...a: any[]) => mutationRequestMock(...a) }));
vi.mock('services/factory/engine', () => ({ tournamentEngine: {} }));

import {
  attachTopologyStructures,
  buildTopologyAttachMethods,
  resolveSourceStructure,
  topologyDrawEntries,
} from './topologyPostGeneration';

const ATTACH_CONSOLATION = 'attachConsolationStructures';
const ATTACH_PLAYOFF = 'attachPlayoffStructures';
const QUALIFYING_NAME = 'Qualifying';
const MAIN_NAME = 'Main Draw';
const CONSOLATION_NAME = 'Qualifying Consolation';

const MAIN_STRUCTURE = { structureId: 'main-id', stage: 'MAIN', structureName: MAIN_NAME };
const QUALIFYING_STRUCTURE = { structureId: 'qual-id', stage: 'QUALIFYING', structureName: QUALIFYING_NAME };
const DRAW = { drawId: 'draw-1', structures: [QUALIFYING_STRUCTURE, MAIN_STRUCTURE] };

const consolationMethod = (source: Record<string, string> = {}) => ({
  method: ATTACH_CONSOLATION,
  params: {
    structureName: CONSOLATION_NAME,
    structureType: 'SINGLE_ELIMINATION',
    drawSize: 32,
    matchUpFormat: undefined,
    structureOptions: undefined,
    links: [{ sourceRoundNumber: 1, targetRoundNumber: 1 }],
    ...source,
  },
});

const engine = {
  generateConsolationStructure: vi.fn((params: any) => ({
    success: true,
    structures: [{ structureId: 'cons-id', structureName: params.structureName, matchUps: [] }],
  })),
  generateAndPopulatePlayoffStructures: vi.fn((params: any) => ({
    structures: [{ structureId: 'po-id' }],
    links: [{ source: { structureId: params.structureId } }],
    matchUpModifications: [],
  })),
};

describe('resolveSourceStructure', () => {
  it('finds the generated structure by the source node stage and name', () => {
    const source = resolveSourceStructure(DRAW.structures, {
      sourceStage: 'QUALIFYING',
      sourceStructureName: QUALIFYING_NAME,
    });
    expect(source?.structureId).toBe('qual-id');
  });

  it('falls back to the only structure of that stage when the name did not survive generation', () => {
    const source = resolveSourceStructure(DRAW.structures, { sourceStage: 'QUALIFYING', sourceStructureName: 'Q' });
    expect(source?.structureId).toBe('qual-id');
  });

  it('is undefined when two structures of that stage exist and neither carries the name', () => {
    const structures = [...DRAW.structures, { structureId: 'qual-2', stage: 'QUALIFYING', structureName: 'Q2' }];
    expect(resolveSourceStructure(structures, { sourceStage: 'QUALIFYING', sourceStructureName: 'Q' })).toBeUndefined();
  });

  it('is the MAIN structure for an untagged method, which is what both consumers did before', () => {
    expect(resolveSourceStructure(DRAW.structures, undefined)?.structureId).toBe('main-id');
    expect(resolveSourceStructure(DRAW.structures, {})?.structureId).toBe('main-id');
  });
});

describe('buildTopologyAttachMethods', () => {
  beforeEach(() => {
    engine.generateConsolationStructure.mockClear();
    engine.generateAndPopulatePlayoffStructures.mockClear();
  });

  it('links a consolation to the QUALIFYING structure its source node names, not to the main', () => {
    const { methods, unresolved } = buildTopologyAttachMethods({
      drawDefinition: DRAW,
      postGenerationMethods: [consolationMethod({ sourceStage: 'QUALIFYING', sourceStructureName: QUALIFYING_NAME })],
      engine,
    });
    expect(unresolved).toEqual([]);
    expect(methods).toHaveLength(1);
    const { method, params } = methods[0];
    expect(method).toBe(ATTACH_CONSOLATION);
    expect(params.drawId).toBe('draw-1');
    expect(params.structures[0].structureId).toBe('cons-id');
    expect(params.links).toEqual([
      {
        linkType: 'LOSER',
        source: { roundNumber: 1, structureId: 'qual-id' },
        target: { roundNumber: 1, feedProfile: 'TOP_DOWN', structureId: 'cons-id' },
      },
    ]);
  });

  it('hands the engine the generation params without the source tags or the link definitions', () => {
    buildTopologyAttachMethods({
      drawDefinition: DRAW,
      postGenerationMethods: [consolationMethod({ sourceStage: 'QUALIFYING', sourceStructureName: QUALIFYING_NAME })],
      engine,
    });
    const handed = engine.generateConsolationStructure.mock.calls[0][0];
    expect(handed).toEqual({
      structureName: CONSOLATION_NAME,
      structureType: 'SINGLE_ELIMINATION',
      drawSize: 32,
      matchUpFormat: undefined,
      structureOptions: undefined,
    });
    expect(handed).not.toHaveProperty('sourceStage');
    expect(handed).not.toHaveProperty('links');
  });

  it('attaches an untagged consolation to the main, as an older converter expects', () => {
    const { methods } = buildTopologyAttachMethods({
      drawDefinition: DRAW,
      postGenerationMethods: [consolationMethod()],
      engine,
    });
    expect(methods[0].params.links[0].source.structureId).toBe('main-id');
  });

  it('reports a consolation whose source cannot be resolved instead of attaching it to the wrong structure', () => {
    const { methods, unresolved } = buildTopologyAttachMethods({
      drawDefinition: DRAW,
      postGenerationMethods: [consolationMethod({ sourceStage: 'PLAY_OFF', sourceStructureName: 'Nope' })],
      engine,
    });
    expect(methods).toEqual([]);
    expect(unresolved).toEqual([CONSOLATION_NAME]);
    expect(engine.generateConsolationStructure).not.toHaveBeenCalled();
  });

  it('reports a consolation the engine refused to generate', () => {
    const refusing = { ...engine, generateConsolationStructure: vi.fn(() => ({ error: { code: 'X' } })) };
    const { methods, unresolved } = buildTopologyAttachMethods({
      drawDefinition: DRAW,
      postGenerationMethods: [consolationMethod({ sourceStage: 'QUALIFYING', sourceStructureName: QUALIFYING_NAME })],
      engine: refusing,
    });
    expect(methods).toEqual([]);
    expect(unresolved).toEqual([CONSOLATION_NAME]);
  });

  it('generates a playoff off the resolved source and forwards what the engine returns', () => {
    const { methods } = buildTopologyAttachMethods({
      drawDefinition: DRAW,
      postGenerationMethods: [
        {
          method: ATTACH_PLAYOFF,
          params: { playoffStructureNameBase: 'PO', sourceStage: 'QUALIFYING', sourceStructureName: QUALIFYING_NAME },
        },
      ],
      engine,
    });
    expect(engine.generateAndPopulatePlayoffStructures.mock.calls[0][0]).toEqual({
      playoffStructureNameBase: 'PO',
      drawId: 'draw-1',
      structureId: 'qual-id',
    });
    expect(methods[0]).toEqual({
      method: ATTACH_PLAYOFF,
      params: {
        matchUpModifications: [],
        structures: [{ structureId: 'po-id' }],
        links: [{ source: { structureId: 'qual-id' } }],
        drawId: 'draw-1',
      },
    });
  });

  it('is empty for a topology with nothing deferred', () => {
    expect(buildTopologyAttachMethods({ drawDefinition: DRAW, postGenerationMethods: [], engine })).toEqual({
      methods: [],
      unresolved: [],
    });
  });
});

describe('attachTopologyStructures', () => {
  beforeEach(() => mutationRequestMock.mockClear());

  it('issues one mutation request for the attaches and reports when it is acknowledged', () => {
    const onDone = vi.fn();
    attachTopologyStructures({
      drawDefinition: DRAW,
      postGenerationMethods: [consolationMethod({ sourceStage: 'QUALIFYING', sourceStructureName: QUALIFYING_NAME })],
      onDone,
      engine,
    });
    expect(mutationRequestMock).toHaveBeenCalledTimes(1);
    const { methods, callback } = mutationRequestMock.mock.calls[0][0];
    expect(methods.map((m: any) => m.method)).toEqual([ATTACH_CONSOLATION]);
    expect(onDone).not.toHaveBeenCalled();
    callback({ success: true });
    expect(onDone).toHaveBeenCalledWith({ unresolved: [] });
  });

  it('reports at once, with no mutation, when nothing could be attached', () => {
    const onDone = vi.fn();
    attachTopologyStructures({
      drawDefinition: DRAW,
      postGenerationMethods: [consolationMethod({ sourceStage: 'PLAY_OFF', sourceStructureName: 'Nope' })],
      onDone,
      engine,
    });
    expect(mutationRequestMock).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith({ unresolved: [CONSOLATION_NAME] });
  });
});

describe('topologyDrawEntries', () => {
  const event = {
    entries: [
      { participantId: 'm1', entryStage: 'MAIN', entryStatus: 'DIRECT_ACCEPTANCE' },
      { participantId: 'm2', entryStatus: 'WILDCARD' },
      { participantId: 'q1', entryStage: 'QUALIFYING', entryStatus: 'DIRECT_ACCEPTANCE' },
      { participantId: 'a1', entryStage: 'MAIN', entryStatus: 'ALTERNATE' },
      { participantId: 'w1', entryStage: 'QUALIFYING', entryStatus: 'WITHDRAWN' },
    ],
  };

  it('includes the QUALIFYING direct entries when the topology has a QUALIFYING node', () => {
    const state = { nodes: [{ stage: 'MAIN' }, { stage: 'QUALIFYING' }] };
    expect(topologyDrawEntries({ event, state }).map((e: any) => e.participantId)).toEqual(['m1', 'm2', 'q1']);
  });

  it('keeps the qualifying entries off a draw with no qualifying structure to place them in', () => {
    const state = { nodes: [{ stage: 'MAIN' }, { stage: 'CONSOLATION' }] };
    expect(topologyDrawEntries({ event, state }).map((e: any) => e.participantId)).toEqual(['m1', 'm2']);
  });

  it('is empty for an event with no entries', () => {
    expect(topologyDrawEntries({ event: {}, state: { nodes: [] } })).toEqual([]);
  });
});
