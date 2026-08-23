import { badgeText, badgeTooltip, headlineRow, shouldRender } from './restBadge';
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
