import { mergeDisplaySettingsValue, scopedDisplaySettings } from './displaySettingsValue';
import { describe, expect, it } from 'vitest';

const snapshot = {
  compositionName: 'Broadcast Bold',
  theme: 'chc-theme-broadcast-bold',
  configuration: { flags: false, matchUpFooter: true, gameScore: { position: 'trailing' as const } },
  colors: { accent: '#ff6a00' },
};

it('preserves complete advanced settings and unrelated extension metadata', () => {
  const value = mergeDisplaySettingsValue({ other: true }, snapshot);
  expect(value).toEqual({ other: true, ...snapshot });
});
it('updates the administrative scope without changing public settings', () => {
  const existing = { admin: { other: true, colors: { accent: '#000000' } }, public: { compositionName: 'National' } };
  const value = mergeDisplaySettingsValue(existing, snapshot);
  expect(value.admin).toEqual({ other: true, ...snapshot });
  expect(value.public).toEqual(existing.public);
  expect(scopedDisplaySettings(value)).toBe(value.admin);
  expect(existing.admin.colors.accent).toBe('#000000');
});
it('clears old colors when a different preset has no overrides', () => {
  const { colors: _colors, ...withoutColors } = snapshot;
  expect(mergeDisplaySettingsValue({ colors: { accent: '#000000' } }, withoutColors)).not.toHaveProperty('colors');
});
describe('legacy display values', () => {
  it('reads unscoped values and handles missing extensions', () => {
    expect(scopedDisplaySettings(snapshot)).toBe(snapshot);
    expect(mergeDisplaySettingsValue(undefined, snapshot)).toEqual(snapshot);
  });
});
