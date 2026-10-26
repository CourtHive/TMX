import { resolveCompositionByName, copyComposition } from './resolveCompositionByName';
import { compositions } from 'courthive-components';
import { describe, expect, it, vi } from 'vitest';

const userCompositions: any[] = [];
vi.mock('pages/templates/compositionBridge', () => ({ getUserCompositionsSync: () => userCompositions }));
// the package touches the DOM on import; these stand in for its presets with the same shape
vi.mock('courthive-components', () => ({
  compositions: {
    Australian: { theme: 'australian', configuration: { flags: true, scheduleInfo: false } },
    Scoreboard: {
      theme: 'basic',
      configuration: { flags: true, scheduleInfo: { elapsed: true, eventRound: true }, serverIndicator: 'column' },
    },
    Watch: {
      theme: 'basic',
      configuration: { flags: true, scheduleInfo: { elapsed: true, eventRound: true, layout: 'inline' } },
    },
  },
}));

describe('resolveCompositionByName', () => {
  it('hands out a copy of a builtin, so changing it leaves the preset alone', () => {
    const before = { ...(compositions as any).Australian.configuration };
    const resolved = resolveCompositionByName('Australian');
    expect(resolved).not.toBe((compositions as any).Australian);
    expect(resolved.configuration).toEqual(before);

    // what the display-settings modal does with a saved Scoreboard snapshot
    Object.assign(resolved.configuration, (compositions as any).Scoreboard.configuration);
    expect((compositions as any).Australian.configuration).toEqual(before);
    expect(resolveCompositionByName('Australian').configuration).toEqual(before);
  });

  it('keeps a builtin preset distinct from the others after one of them is changed', () => {
    const scoreboard = resolveCompositionByName('Scoreboard');
    scoreboard.configuration.scheduleInfo = true;
    expect(resolveCompositionByName('Watch').configuration.scheduleInfo).toMatchObject({ layout: 'inline' });
    expect(resolveCompositionByName('Scoreboard').configuration.scheduleInfo).toMatchObject({ eventRound: true });
  });

  it('prefers a user composition of the same name, also as a copy', () => {
    userCompositions.push({ name: 'Mine', composition: { theme: 'x', configuration: { flags: true } } });
    const resolved = resolveCompositionByName('Mine');
    resolved.configuration.flags = false;
    expect(resolveCompositionByName('Mine').configuration.flags).toBe(true);
    userCompositions.length = 0;
  });

  it('returns undefined for no name or an unknown one', () => {
    expect(resolveCompositionByName(undefined)).toBeUndefined();
    expect(resolveCompositionByName('Nope')).toBeUndefined();
  });
});

describe('copyComposition', () => {
  it('copies configuration and colors, and adds no colors that were not there', () => {
    const source = { theme: 't', configuration: { a: 1 }, colors: { c: 'red' } };
    const copy = copyComposition(source);
    copy.configuration.a = 2;
    copy.colors.c = 'blue';
    expect(source).toEqual({ theme: 't', configuration: { a: 1 }, colors: { c: 'red' } });
    expect('colors' in copyComposition({ configuration: {} })).toBe(false);
  });
});
