import { defaultMatchUpFormat, defaultTopology, STANDARD_ADVANTAGE } from './topologyDefaults';
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
    // 28 main entries in a 32 leave 4 places; 12 qualifying entrants produce those 4 (a 16 draw with byes)
    const state: any = defaultTopology(event(entries(28), entries(12, 'DIRECT_ACCEPTANCE', 'QUALIFYING')));
    const main = node(state, 'MAIN');
    const qualifying = node(state, 'QUALIFYING');
    expect(main.drawSize).toBe(32);
    expect(qualifying).toMatchObject({ drawSize: 12, qualifyingPositions: 4 });
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

  it('qualifiers are a count the qualifying structure can produce, every one of them winning a match', () => {
    // 26 in a 32 leave 6 places: 12 entrants produce 6, 4, 3, 2 or 1, so 6; 3 entrants produce 1 (a second would
    // qualify on a bye)
    expect(
      node(defaultTopology(event(entries(26), entries(12, 'DIRECT_ACCEPTANCE', 'QUALIFYING'))), 'QUALIFYING')
        .qualifyingPositions,
    ).toBe(6);
    expect(
      node(defaultTopology(event(entries(26), entries(3, 'DIRECT_ACCEPTANCE', 'QUALIFYING'))), 'QUALIFYING'),
    ).toMatchObject({
      drawSize: 3,
      qualifyingPositions: 1,
    });
  });

  it('a full Main grows to take the default qualifiers when there are no places left over', () => {
    const state: any = defaultTopology(event(entries(32), entries(16, 'DIRECT_ACCEPTANCE', 'QUALIFYING')));
    expect(node(state, 'QUALIFYING')).toMatchObject({ drawSize: 16, qualifyingPositions: 4 });
    expect(node(state, 'MAIN').drawSize).toBe(64);
  });

  describe("handed the Add Draw drawer's choices", () => {
    it('opens the draw the drawer describes: its name, Main type and size', () => {
      const state: any = defaultTopology(event(entries(20)), {
        drawName: 'Gold',
        drawType: 'FEED_IN_CHAMPIONSHIP',
        drawSize: 32,
      });
      expect(state.drawName).toBe('Gold');
      expect(node(state, 'MAIN')).toMatchObject({ structureType: 'FEED_IN_CHAMPIONSHIP', drawSize: 32 });
    });

    it('a Main type the builder does not lay out opens as single elimination', () => {
      const state: any = defaultTopology(event(entries(20)), { drawType: 'CURTIS_CONSOLATION', drawSize: 32 });
      expect(node(state, 'MAIN').structureType).toBe('SINGLE_ELIMINATION');
    });

    it("takes the drawer's qualifiers, as a count the qualifying draw can produce", () => {
      const state: any = defaultTopology(event(entries(28), entries(12, 'DIRECT_ACCEPTANCE', 'QUALIFYING')), {
        drawSize: 32,
        qualifiersCount: 2,
      });
      expect(node(state, 'QUALIFYING')).toMatchObject({ drawSize: 12, qualifyingPositions: 2 });
      expect(state.edges[0].qualifyingPositions).toBe(2);
    });

    it('no qualifiers in the drawer is a draw without a qualifying structure', () => {
      const state: any = defaultTopology(event(entries(28), entries(12, 'DIRECT_ACCEPTANCE', 'QUALIFYING')), {
        drawSize: 32,
        qualifiersCount: 0,
      });
      expect(state.nodes).toHaveLength(1);
      expect(state.edges).toEqual([]);
    });
  });

  // a generated event (CA, 2026-11-17): 24 main entries and 40 qualifying, the Main a 40 with 16 qualifiers
  it('40 qualifying entrants for 16 qualifiers: a qualifying structure of 40, which the factory plays as a 64', () => {
    const state: any = defaultTopology(event(entries(24), entries(40, 'DIRECT_ACCEPTANCE', 'QUALIFYING')), {
      drawSize: 40,
      qualifiersCount: 16,
    });
    expect(node(state, 'QUALIFYING')).toMatchObject({ drawSize: 40, qualifyingPositions: 16 });
    // any count up to half the entrants is kept (CA, 2026-11-18: 18 of 40 is a 72 draw); more is brought down to half
    const eighteen: any = defaultTopology(event(entries(24), entries(40, 'DIRECT_ACCEPTANCE', 'QUALIFYING')), {
      drawSize: 42,
      qualifiersCount: 18,
    });
    expect(node(eighteen, 'QUALIFYING').qualifyingPositions).toBe(18);
    const tooMany: any = defaultTopology(event(entries(24), entries(40, 'DIRECT_ACCEPTANCE', 'QUALIFYING')), {
      drawSize: 48,
      qualifiersCount: 25,
    });
    expect(node(tooMany, 'QUALIFYING').qualifyingPositions).toBe(20);
  });

  describe('the format each structure starts on (CA, 2026-11-17)', () => {
    const PRO_SET = 'SET1-S:8/TB7';
    it("the event's own, else its competition format's, else the tournament's, else Standard Advantage", () => {
      expect(defaultMatchUpFormat({ matchUpFormat: PRO_SET })).toBe(PRO_SET);
      expect(defaultMatchUpFormat({ competitionFormat: { matchUpFormat: 'SET3-S:4/TB7' } })).toBe('SET3-S:4/TB7');
      expect(defaultMatchUpFormat({}, { competitionFormat: { matchUpFormat: 'SET3-S:6NOAD/TB7' } })).toBe(
        'SET3-S:6NOAD/TB7',
      );
      expect(defaultMatchUpFormat({})).toBe(STANDARD_ADVANTAGE);
    });

    it('every structure of a new draw starts on it', () => {
      const state: any = defaultTopology(event(entries(28), entries(12, 'DIRECT_ACCEPTANCE', 'QUALIFYING')));
      expect(state.nodes.map((n: any) => n.matchUpFormat)).toEqual([STANDARD_ADVANTAGE, STANDARD_ADVANTAGE]);
      const set: any = defaultTopology({ ...event(entries(20)), matchUpFormat: PRO_SET });
      expect(node(set, 'MAIN').matchUpFormat).toBe(PRO_SET);
    });
  });
});
