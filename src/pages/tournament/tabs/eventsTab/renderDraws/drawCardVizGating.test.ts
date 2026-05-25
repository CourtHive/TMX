import { describe, it, expect } from 'vitest';

import { resolveDisplayMode, buildDisplayModeOptions, isSunburstMode, SUNBURST_CAP } from './drawCardVizGating';

const COMPETITIVE = 'sunburst-competitive' as const;

const avail = (hasRatings: boolean, hasCompetitiveness: boolean) => ({ hasRatings, hasCompetitiveness });

describe('isSunburstMode', () => {
  it('matches both burst variants and nothing else', () => {
    expect(isSunburstMode('sunburst')).toBe(true);
    expect(isSunburstMode(COMPETITIVE)).toBe(true);
    expect(isSunburstMode('histogram')).toBe(false);
    expect(isSunburstMode('none')).toBe(false);
  });
});

describe('resolveDisplayMode — burst variants', () => {
  it('allows burst (progression) under the cap', () => {
    const r = resolveDisplayMode({ requested: 'sunburst', drawCount: 1, availability: avail(false, false) });
    expect(r).toMatchObject({ mode: 'sunburst', gated: false });
  });

  it('allows burst (competitive) when completed matches exist', () => {
    const r = resolveDisplayMode({ requested: COMPETITIVE, drawCount: 1, availability: avail(false, true) });
    expect(r).toMatchObject({ mode: COMPETITIVE, gated: false });
  });

  it('gates burst (competitive) when there are no completed matches', () => {
    const r = resolveDisplayMode({ requested: COMPETITIVE, drawCount: 1, availability: avail(false, false) });
    expect(r).toMatchObject({ mode: 'none', gated: true, reason: 'no-competitiveness' });
  });

  it('gates both burst variants at/over the SUNBURST_CAP', () => {
    const a = avail(false, true);
    expect(resolveDisplayMode({ requested: 'sunburst', drawCount: SUNBURST_CAP, availability: a }).reason).toBe(
      'sunburst-too-many',
    );
    expect(
      resolveDisplayMode({ requested: COMPETITIVE, drawCount: SUNBURST_CAP, availability: a }).reason,
    ).toBe('sunburst-too-many');
  });
});

describe('buildDisplayModeOptions — burst variants', () => {
  it('offers both burst options under the cap', () => {
    const opts = buildDisplayModeOptions({ drawCount: 1, availability: avail(true, true) });
    expect(opts.filter((o) => isSunburstMode(o.value)).map((o) => o.value)).toEqual([
      'sunburst',
      COMPETITIVE,
    ]);
  });

  it('disables burst (competitive) when there are no completed matches', () => {
    const opts = buildDisplayModeOptions({ drawCount: 1, availability: avail(true, false) });
    expect(opts.find((o) => o.value === COMPETITIVE)?.disabled).toBe(true);
  });

  it('omits burst options at/over the cap', () => {
    const opts = buildDisplayModeOptions({ drawCount: SUNBURST_CAP, availability: avail(true, true) });
    expect(opts.some((o) => isSunburstMode(o.value))).toBe(false);
  });
});
