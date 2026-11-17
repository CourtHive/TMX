import { defaultTopology } from './topologyDefaults';
import { describe, expect, it } from 'vitest';

/**
 * The topology a new draw opens with: the structures the event's accepted entries call for (CA, 2026-11-16).
 */
const entries = (count: number, entryStatus = 'DIRECT_ACCEPTANCE', entryStage?: string) =>
  Array.from({ length: count }, (_, i) => ({
    participantId: `${entryStage ?? 'M'}-${entryStatus}-${i}`,
    entryStatus,
    entryStage,
  }));
const event = (...groups: any[][]) => ({ eventName: 'Open Singles', entries: groups.flat() });
const node = (state: any, stage: string) => state.nodes.find((n: any) => n.stage === stage);

describe('defaultTopology', () => {
  it('no accepted MAIN entries, no default', () => {
    expect(defaultTopology(event())).toBeUndefined();
    expect(defaultTopology(event(entries(6, 'ALTERNATE')))).toBeUndefined();
    expect(defaultTopology(event(entries(8, 'DIRECT_ACCEPTANCE', 'QUALIFYING')))).toBeUndefined();
  });

  it('MAIN entries alone: one Main, the power of two that holds them; alternates and withdrawals do not count', () => {
    const state: any = defaultTopology(
      event(entries(24), entries(4, 'WILDCARD'), entries(6, 'ALTERNATE'), entries(2, 'WITHDRAWN')),
    );
    expect(state.nodes).toHaveLength(1);
    expect(node(state, 'MAIN')).toMatchObject({ structureType: 'SINGLE_ELIMINATION', drawSize: 32 });
    expect(state.edges).toEqual([]);
    expect(state.drawName).toBe('Open Singles');
  });

  it("with QUALIFYING entries: the drawer's places left over become qualifiers, linked into the Main's first round", () => {
    // 28 main entries in a 32 leave 4 places; 12 qualifying entries make a 16 that produces those 4
    const state: any = defaultTopology(event(entries(28), entries(12, 'DIRECT_ACCEPTANCE', 'QUALIFYING')));
    const main = node(state, 'MAIN');
    const qualifying = node(state, 'QUALIFYING');
    expect(main.drawSize).toBe(32);
    expect(qualifying).toMatchObject({ drawSize: 16, qualifyingPositions: 4 });
    expect(state.edges).toEqual([
      expect.objectContaining({
        sourceNodeId: qualifying.id,
        targetNodeId: main.id,
        linkType: 'WINNER',
        targetRoundNumber: 1,
        qualifyingPositions: 4,
      }),
    ]);
  });

  it('qualifiers are a count an elimination draw can produce: a power of two, at most half the qualifying draw', () => {
    // 26 in a 32 leave 6 places: 4 qualifiers; 3 qualifying entries make a 4, which produces at most 2
    expect(
      node(defaultTopology(event(entries(26), entries(12, 'DIRECT_ACCEPTANCE', 'QUALIFYING'))), 'QUALIFYING')
        .qualifyingPositions,
    ).toBe(4);
    expect(
      node(defaultTopology(event(entries(26), entries(3, 'DIRECT_ACCEPTANCE', 'QUALIFYING'))), 'QUALIFYING'),
    ).toMatchObject({
      drawSize: 4,
      qualifyingPositions: 2,
    });
  });

  it('a full Main grows to take the default qualifiers when there are no places left over', () => {
    const state: any = defaultTopology(event(entries(32), entries(16, 'DIRECT_ACCEPTANCE', 'QUALIFYING')));
    expect(node(state, 'QUALIFYING')).toMatchObject({ drawSize: 16, qualifyingPositions: 4 });
    expect(node(state, 'MAIN').drawSize).toBe(64);
  });
});
