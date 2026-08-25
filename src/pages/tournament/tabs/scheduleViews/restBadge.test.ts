import { badgeModel, badgeText, badgeTooltip, headlineRow, shouldRender } from './restBadge';
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

describe('headlineRow — worst status decides the badge', () => {
  it('prefers onCourt over everything', () => {
    const rows = [row({ status: 'rested' }), row({ status: 'onCourt' }), row({ status: 'resting' })];
    expect(headlineRow(rows)?.status).toBe('onCourt');
  });

  it('prefers resting over rested and none', () => {
    expect(headlineRow([row({ status: 'none' }), row({ status: 'rested' }), row({ status: 'resting' })])?.status).toBe(
      'resting',
    );
  });

  it('falls through to rested, then none', () => {
    expect(headlineRow([row({ status: 'none' }), row({ status: 'rested' })])?.status).toBe('rested');
    expect(headlineRow([row({ status: 'none' })])?.status).toBe('none');
  });

  it('returns undefined for an empty set', () => {
    expect(headlineRow([])).toBeUndefined();
  });
});

describe('shouldRender — silence when there is nothing to say', () => {
  const asResult = (rows: RestRow[]): RestResult => ({ evaluated: true, asOfMinutes: 860, rows });

  it('does not badge a card where nobody has played today', () => {
    expect(shouldRender(asResult([row({ status: 'none' }), row({ status: 'none', participantId: 'p2' })]))).toBe(false);
  });

  it('badges as soon as one participant has a prior match', () => {
    expect(shouldRender(asResult([row({ status: 'none' }), row({ status: 'rested', participantId: 'p2' })]))).toBe(
      true,
    );
  });

  it('does not badge an unevaluated matchUp', () => {
    expect(shouldRender({ evaluated: false, reason: 'bye' })).toBe(false);
  });
});

describe('badgeText / badgeTooltip', () => {
  it('reports a duration for resting and rested, and a word where a duration would be a fiction', () => {
    expect(badgeText(row({ status: 'resting', restMinutes: 32 }))).toContain('32');
    expect(badgeText(row({ status: 'rested', restMinutes: 134 }))).toContain('14');
    // onCourt / none have no elapsed rest to report, so they must not render "0m".
    expect(badgeText(row({ status: 'onCourt' }))).not.toMatch(/\d/);
    expect(badgeText(row({ status: 'none' }))).not.toMatch(/\d/);
  });

  it('resolves its i18n keys — never leaks a dotted key path at the operator', () => {
    // `t()` echoes the key when it resolves to nothing, and a key path contains
    // no digits, so the duration assertions above cannot catch an unresolved
    // key on the digit-free branches. This is the check that can.
    const texts = [
      badgeText(row({ status: 'onCourt' })),
      badgeText(row({ status: 'none' })),
      badgeText(row({ status: 'resting', restMinutes: 32 })),
      badgeText(row({ status: 'rested', restMinutes: 134 })),
      badgeTooltip([row({ status: 'onCourt' })]),
      badgeTooltip([row({ status: 'none' })]),
      badgeTooltip([row({ status: 'resting', restMinutes: 32 })]),
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/schedule\.[a-z]/i);
      expect(text.trim()).not.toBe('');
    }
  });

  it('interpolates every placeholder — no `{{name}}` reaches the operator', () => {
    const tooltip = badgeTooltip([
      row({ status: 'resting', restMinutes: 32 }),
      row({ status: 'onCourt', participantId: 'p2', participantName: 'Bob' }),
      row({ status: 'none', participantId: 'p3', participantName: 'Chen' }),
    ]);
    expect(tooltip).not.toContain('{{');
  });

  it('names every participant in the tooltip, not just the headline', () => {
    const tooltip = badgeTooltip([
      row({ status: 'resting', restMinutes: 32 }),
      row({ status: 'rested', participantId: 'p2', participantName: 'Bob' }),
    ]);
    expect(tooltip).toContain('Alice');
    expect(tooltip).toContain('Bob');
    expect(tooltip.split('\n')).toHaveLength(2);
  });
});

// ── Regressions: the two states the analysis gained on 2026-08-23 ────────────

describe('badge honesty for states that carry no measurable interval', () => {
  it('says the rest is unknown rather than showing the arithmetic zero', () => {
    expect(badgeText(row({ status: 'resting', restMinutes: 0, anchorUnreliable: true }))).not.toMatch(/0/);
  });

  it('still shows a duration for an ordinary resting row', () => {
    expect(badgeText(row({ status: 'resting', restMinutes: 22 }))).toMatch(/22/);
  });

  it('distinguishes an overrunning match from one inside its expected duration', () => {
    const overrun = badgeTooltip([row({ status: 'onCourt', overrun: true })]);
    const normal = badgeTooltip([row({ status: 'onCourt' })]);
    expect(overrun).not.toEqual(normal);
  });
});

/**
 * The badge counts up, so a paint-once badge is wrong from the second after it
 * renders — and a stale badge beside a live Inspector reading something else is
 * worse than either alone. `badgeModel` is the single derivation both the first
 * paint and every repaint go through; a ticker that rebuilt the badge by a
 * parallel route would drift from the original, which is the shape of the bug
 * this file's history is about.
 *
 * Only the model is asserted here. The DOM half (`applyBadge`, the interval)
 * cannot be reached — TMX's vitest run has no DOM — and belongs to a journey.
 */
describe('badgeModel — one derivation for the first paint and every repaint', () => {
  function result(rows: RestRow[]): RestResult {
    return { evaluated: true, asOfMinutes: 700, rows };
  }

  it('returns null when there is nothing worth drawing', () => {
    expect(badgeModel({ evaluated: false, reason: 'bye' })).toBeNull();
    expect(badgeModel(result([row({ status: 'none' })]))).toBeNull();
  });

  it("carries the headline row's status and text", () => {
    const model = badgeModel(result([row({ status: 'rested' }), row({ status: 'resting', restMinutes: 41 })]));
    expect(model).toMatchObject({ status: 'resting', text: badgeText(row({ status: 'resting', restMinutes: 41 })) });
  });

  it('agrees with badgeText and badgeTooltip rather than re-deriving them', () => {
    const rows = [row({ status: 'onCourt' }), row({ status: 'rested', restMinutes: 200 })];
    const model = badgeModel(result(rows));
    expect(model?.text).toBe(badgeText(headlineRow(rows)!));
    expect(model?.title).toBe(badgeTooltip(rows));
  });

  it('leaves the limit fields empty when no daily limit is met, so a repaint clears the marker', () => {
    const model = badgeModel(result([row({ status: 'resting', restMinutes: 10 })]));
    expect(model?.atLimit).toBe('');
    expect(model?.limitText).toBe('');
  });

  it('carries the limit marker when one is met', () => {
    const atLimit = row({
      status: 'resting',
      restMinutes: 10,
      load: { singles: 2, doubles: 0, total: 2, ordinal: 3, atLimit: ['singles', 'total'], limit: 3 },
    });
    const model = badgeModel(result([atLimit]));
    expect(model?.atLimit).toBe('singles,total');
    expect(model?.limitText).not.toBe('');
  });

  it('reports a status transition as the clock moves, which is the whole point of ticking', () => {
    // The same participant, evaluated 30 seconds apart across the requirement.
    const before = badgeModel(result([row({ status: 'resting', restMinutes: 59, requiredMinutes: 60 })]));
    const after = badgeModel(result([row({ status: 'rested', restMinutes: 60, requiredMinutes: 60 })]));
    expect(before?.status).toBe('resting');
    expect(after?.status).toBe('rested');
    expect(before?.text).not.toBe(after?.text);
  });
});
