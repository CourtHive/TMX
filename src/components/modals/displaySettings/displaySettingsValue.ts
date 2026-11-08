import type { SavedComposition } from 'courthive-components';

/** Prefer the administrative scope while preserving other scopes on save. */
export function scopedDisplaySettings(value: any): any {
  return value?.admin ?? value;
}

export function mergeDisplaySettingsValue(existing: any, saved: SavedComposition): any {
  const { colors: _oldColors, ...previous } = scopedDisplaySettings(existing) ?? {};
  const next = {
    ...previous,
    compositionName: saved.compositionName,
    theme: saved.theme,
    configuration: saved.configuration,
    ...(saved.colors ? { colors: saved.colors } : {}),
  };
  return existing?.admin ? { ...existing, admin: next } : next;
}
