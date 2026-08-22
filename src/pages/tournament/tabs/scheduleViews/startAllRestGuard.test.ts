import { collectStartAllRestWarning, isBlocker } from './startAllRestGuard';
import { describe, expect, it } from 'vitest';

// constants and types
import type { RestResult, RestRow } from './participantRest';

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

const evaluated = (rows: RestRow[]): RestResult => ({ evaluated: true, asOfMinutes: 860, rows });

describe('isBlocker', () => {
  it('treats onCourt and resting as blockers, rested and none as clear', () => {
    expect(isBlocker(row({ status: 'onCourt' }))).toBe(true);
    expect(isBlocker(row({ status: 'resting' }))).toBe(true);
    expect(isBlocker(row({ status: 'rested' }))).toBe(false);
    expect(isBlocker(row({ status: 'none' }))).toBe(false);
  });
});

describe('collectStartAllRestWarning', () => {
  it('returns undefined when everyone is clear — the caller skips the confirm entirely', () => {
    const warning = collectStartAllRestWarning([{ matchUpId: 'm1' }, { matchUpId: 'm2' }], () =>
      evaluated([row({ status: 'rested' }), row({ status: 'none', participantId: 'p2' })]),
    );
    expect(warning).toBeUndefined();
  });

  it('collects a resting player with their elapsed and required minutes', () => {
    const warning = collectStartAllRestWarning([{ matchUpId: 'm1', courtName: 'Court 3' }], () =>
      evaluated([row({ status: 'resting', restMinutes: 32 })]),
    );
    expect(warning?.blockers).toEqual([
      {
        matchUpId: 'm1',
        courtName: 'Court 3',
        participantName: 'Alice',
        restMinutes: 32,
        requiredMinutes: 60,
        onCourt: false,
      },
    ]);
    expect(warning?.affectedMatchUpIds).toEqual(['m1']);
  });

  it('omits restMinutes for a player still on court rather than reporting zero', () => {
    const warning = collectStartAllRestWarning([{ matchUpId: 'm1' }], () => evaluated([row({ status: 'onCourt' })]));
    expect(warning?.blockers[0].onCourt).toBe(true);
    expect(warning?.blockers[0]).not.toHaveProperty('restMinutes');
  });

  it('reports every blocker but counts each matchUp once', () => {
    const warning = collectStartAllRestWarning([{ matchUpId: 'm1' }], () =>
      evaluated([
        row({ status: 'resting', restMinutes: 10 }),
        row({ status: 'resting', restMinutes: 20, participantId: 'p2', participantName: 'Bob' }),
        row({ status: 'rested', participantId: 'p3', participantName: 'Chen' }),
      ]),
    );
    expect(warning?.blockers.map((b) => b.participantName)).toEqual(['Alice', 'Bob']);
    expect(warning?.affectedMatchUpIds).toEqual(['m1']);
  });

  it('spans several matchUps', () => {
    const warning = collectStartAllRestWarning([{ matchUpId: 'm1' }, { matchUpId: 'm2' }, { matchUpId: 'm3' }], (id) =>
      id === 'm2' ? evaluated([row({ status: 'rested' })]) : evaluated([row({ status: 'resting', restMinutes: 5 })]),
    );
    expect(warning?.affectedMatchUpIds).toEqual(['m1', 'm3']);
  });

  it('skips a matchUp whose rest could not be evaluated rather than assuming it is clear', () => {
    const warning = collectStartAllRestWarning([{ matchUpId: 'm1' }], () => ({ evaluated: false, reason: 'bye' }));
    expect(warning).toBeUndefined();
  });
});
