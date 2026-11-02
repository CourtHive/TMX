import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';
import {
  compareStructure,
  orderByReadiness,
  readinessKey,
  readinessRank,
  matchUpStructureSequences,
  structureSequences,
  ON_COURT,
  READY,
  RECOVERING,
} from './catalogOrder';

// constants and types
import type { RestResult, RestRow } from 'tods-competition-factory';
import type { OrderableMatchUp } from './catalogOrder';

const MEASURED = { asOf: '2026-10-31T14:00:00.000Z', scheduledDate: '2026-10-31' };
const LOAD = { singles: 1, doubles: 0, total: 1, ordinal: 2, atLimit: [] };

function row(overrides: Partial<RestRow>): RestRow {
  return {
    participantId: 'p1',
    participantName: 'Alice',
    status: 'rested',
    requiredMinutes: 60,
    typeChange: false,
    load: LOAD,
    ...overrides,
  } as RestRow;
}

const result = (...rows: RestRow[]): RestResult => ({ evaluated: true, ...MEASURED, rows });

const rested = (restMinutes = 90) => result(row({ status: 'rested', restMinutes }), row({ status: 'none' }));
const resting = (restMinutes: number) => result(row({ status: 'resting', restMinutes }), row({ status: 'none' }));
const onCourt = () => result(row({ status: 'onCourt' }), row({ status: 'none' }));

describe('readinessKey — the band comes from the worst participant on the card', () => {
  it('reads a card where everyone is recovered, or has not played, as ready', () => {
    expect(readinessKey(rested())).toEqual({ band: READY, shortfall: 0 });
    expect(readinessKey(result(row({ status: 'none' }), row({ status: 'none' })))).toEqual({
      band: READY,
      shortfall: 0,
    });
  });

  it('reads an unevaluated matchUp as ready — nothing says to wait for it', () => {
    expect(readinessKey({ evaluated: false, reason: 'noAsOf' })).toEqual({ band: READY, shortfall: 0 });
  });

  it('measures a recovering card by how long until it is ready', () => {
    expect(readinessKey(resting(27))).toEqual({ band: RECOVERING, shortfall: 33 });
  });

  it('lets one recovering participant hold back a card the other is ready for', () => {
    const mixed = result(row({ status: 'rested', restMinutes: 120 }), row({ status: 'resting', restMinutes: 50 }));
    expect(readinessKey(mixed)).toEqual({ band: RECOVERING, shortfall: 10 });
  });

  it('counts the whole requirement as outstanding when a recovering row reports no rest figure', () => {
    expect(readinessKey(result(row({ status: 'resting', restMinutes: undefined })))).toEqual({
      band: RECOVERING,
      shortfall: 60,
    });
  });

  it('counts the whole requirement as outstanding when the anchor is unreliable', () => {
    const unreliable = result(row({ status: 'resting', restMinutes: 0, anchorUnreliable: true }));
    expect(readinessKey(unreliable)).toEqual({ band: RECOVERING, shortfall: 60 });
  });

  it('puts a participant still on court, or a side still being decided, last', () => {
    expect(readinessKey(onCourt()).band).toBe(ON_COURT);
    expect(readinessKey(result(row({ status: 'onCourt', pendingUpstream: true }))).band).toBe(ON_COURT);
  });
});

describe('orderByReadiness', () => {
  const mu = (matchUpId: string, extra: Partial<OrderableMatchUp> = {}): OrderableMatchUp => ({ matchUpId, ...extra });
  const ids = (list: OrderableMatchUp[]) => list.map((m) => m.matchUpId);

  it('lists ready cards above recovering ones, and recovering by soonest ready', () => {
    const rests: Record<string, RestResult> = {
      a: resting(27),
      b: rested(78),
      c: onCourt(),
      d: resting(55),
      e: rested(85),
    };
    const ordered = orderByReadiness([mu('a'), mu('b'), mu('c'), mu('d'), mu('e')], (id) => rests[id]);
    expect(ids(ordered)).toEqual(['b', 'e', 'd', 'a', 'c']);
  });

  it('breaks readiness ties by draw order, never by matchUpId', () => {
    // ids deliberately sort opposite to draw order
    const list = [
      mu('a', { roundNumber: 2, roundPosition: 1 }),
      mu('b', { roundNumber: 1, roundPosition: 4 }),
      mu('c', { roundNumber: 1, roundPosition: 2 }),
    ];
    expect(ids(orderByReadiness(list, () => rested()))).toEqual(['c', 'b', 'a']);
  });

  it('keeps the incoming order when nothing separates two cards', () => {
    expect(ids(orderByReadiness([mu('z'), mu('a'), mu('m')], () => rested()))).toEqual(['z', 'a', 'm']);
  });

  it('orders by time first when asked, so readiness only separates cards at the same time', () => {
    const rests: Record<string, RestResult> = { early: resting(10), late: rested(), sameTimeReady: rested() };
    const time: Record<string, number> = { early: 600, late: 690, sameTimeReady: 600 };
    const list = [mu('late'), mu('early'), mu('sameTimeReady')];
    const ordered = orderByReadiness(list, (id) => rests[id], { byTime: (m) => time[m.matchUpId] });
    expect(ids(ordered)).toEqual(['sameTimeReady', 'early', 'late']);
  });

  it('treats two untimed cards as the same time rather than as incomparable', () => {
    const rests: Record<string, RestResult> = { a: resting(10), b: rested() };
    const ordered = orderByReadiness([mu('a'), mu('b')], (id) => rests[id], {
      byTime: () => Number.POSITIVE_INFINITY,
    });
    expect(ids(ordered)).toEqual(['b', 'a']);
  });

  it('does not mutate its input', () => {
    const list = [mu('a'), mu('b')];
    const rests: Record<string, RestResult> = { a: onCourt(), b: rested() };
    orderByReadiness(list, (id) => rests[id]);
    expect(ids(list)).toEqual(['a', 'b']);
  });
});

describe('compareStructure', () => {
  it('sorts a matchUp with no round or position after ones that have them', () => {
    expect(compareStructure({ matchUpId: 'a' }, { matchUpId: 'b', roundNumber: 1 })).toBeGreaterThan(0);
    expect(
      compareStructure({ matchUpId: 'a', roundNumber: 1, roundPosition: 3 }, { matchUpId: 'b', roundNumber: 1 }),
    ).toBeLessThan(0);
    expect(compareStructure({ matchUpId: 'a' }, { matchUpId: 'b' })).toBe(0);
  });
});

describe('readinessRank — the key as the one number the catalog groups by', () => {
  it('orders exactly as the key does: band first, then shortfall', () => {
    const keys = [
      readinessKey(onCourt()),
      readinessKey(resting(5)),
      readinessKey(rested()),
      readinessKey(resting(50)),
      readinessKey({ evaluated: false, reason: 'noAsOf' }),
    ];
    const byKey = [...keys].sort((a, b) => a.band - b.band || a.shortfall - b.shortfall);
    const byRank = [...keys].sort((a, b) => readinessRank(a) - readinessRank(b));
    expect(byRank).toEqual(byKey);
  });

  it('keeps the longest plausible shortfall inside its band', () => {
    // A full day of required recovery still ranks ahead of anyone on court.
    expect(readinessRank({ band: RECOVERING, shortfall: 24 * 60 })).toBeLessThan(
      readinessRank({ band: ON_COURT, shortfall: 0 }),
    );
  });
});

describe('structureSequences — each structure’s place in its draw’s play order', () => {
  // Real draws from the factory, so the test is about the order the generators and `structureSort` produce.
  const structuresOf = (drawProfile: any): any[] => {
    const { tournamentRecord } = mocksEngine.generateTournamentRecord({ drawProfiles: [drawProfile] });
    return tournamentRecord.events[0].drawDefinitions[0].structures;
  };
  const named = (structures: any[]) => {
    const sequences = structureSequences(structures);
    return structures
      .toSorted((a, b) => (sequences.get(a.structureId) ?? 0) - (sequences.get(b.structureId) ?? 0))
      .map((s) => `${s.structureName}:${sequences.get(s.structureId)}`);
  };

  it('runs a compass draw outward from East, the order its structures go onto the grid', () => {
    // Stored and sorted orders differ (Southwest and Southeast), so this reads the sort, not the array.
    expect(named(structuresOf({ drawSize: 32, drawType: 'COMPASS' }))).toEqual([
      'East:0',
      'West:1',
      'North:2',
      'South:3',
      'Northeast:4',
      'Northwest:5',
      'Southwest:6',
      'Southeast:7',
    ]);
  });

  it('counts qualifying on its own, so the main structure is position 0 either way', () => {
    const structures = structuresOf({
      drawSize: 16,
      qualifyingProfiles: [{ structureProfiles: [{ drawSize: 16, qualifyingPositions: 4 }] }],
    });
    expect(named(structures)).toEqual(['Qualifying:0', 'Main:0']);
  });

  it('puts a consolation after the main draw it is fed from', () => {
    expect(named(structuresOf({ drawSize: 16, drawType: 'FEED_IN_CHAMPIONSHIP' }))).toEqual([
      'Main:0',
      'Consolation:1',
    ]);
  });

  it('does not depend on the order the structures arrive in', () => {
    const structures = structuresOf({ drawSize: 32, drawType: 'COMPASS' });
    expect(structureSequences(structures.toReversed())).toEqual(structureSequences(structures));
  });
});

describe('matchUpStructureSequences — the draw lookup, per matchUp', () => {
  const seed = (drawProfiles: any[]) => {
    mocksEngine.generateTournamentRecord({ setState: true, drawProfiles });
    const matchUps: any[] = tournamentEngine.allTournamentMatchUps({ inContext: true }).matchUps ?? [];
    const calls: string[] = [];
    const structuresOf = (drawId: string) => {
      calls.push(drawId);
      return tournamentEngine.getEvent({ drawId }).drawDefinition.structures;
    };
    return { matchUps, calls, structuresOf };
  };

  it('gives a round robin group’s matchUps their container’s position, not none', () => {
    const { matchUps, structuresOf } = seed([{ drawSize: 8, drawType: 'ROUND_ROBIN_WITH_PLAYOFF' }]);
    const sequences = matchUpStructureSequences(matchUps, structuresOf);
    const group = matchUps.find((m: any) => m.containerStructureId);
    const playoff = matchUps.find((m: any) => !m.containerStructureId);
    // The premise: a group matchUp's own structureId is not a top-level structure.
    expect(group.structureId).not.toBe(group.containerStructureId);
    expect(sequences.get(group.matchUpId)).toBe(0);
    expect(sequences.get(playoff.matchUpId)).toBe(1);
  });

  it('looks each draw up once, however many matchUps it has', () => {
    const { matchUps, calls, structuresOf } = seed([
      { drawSize: 16, drawType: 'COMPASS' },
      { drawSize: 16, drawType: 'FEED_IN_CHAMPIONSHIP' },
    ]);
    const sequences = matchUpStructureSequences(matchUps, structuresOf);
    expect(calls).toHaveLength(2);
    expect(sequences.size).toBe(matchUps.length);
  });

  it('leaves a matchUp with no known structure unsequenced rather than guessing', () => {
    const sequences = matchUpStructureSequences(
      [
        { matchUpId: 'orphan', drawId: 'd', structureId: 's' },
        { matchUpId: 'bare', drawId: 'd' },
      ],
      () => [{ structureId: 'other' }],
    );
    expect(sequences.has('orphan')).toBe(false);
    expect(sequences.has('bare')).toBe(false);
  });
});
