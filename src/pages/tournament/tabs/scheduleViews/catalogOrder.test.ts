import { compareStructure, orderByReadiness, readinessKey, ON_COURT, READY, RECOVERING } from './catalogOrder';
import { describe, expect, it } from 'vitest';

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
