import { beforeEach, describe, expect, it, vi } from 'vitest';
import { preferencesConfig } from 'config/preferencesConfig';
import { featureFlags } from 'config/featureFlags';
import {
  hydrateConfigFromStorage,
  persistConfigToStorage,
  saveSettings,
  clearSettings,
  loadSettings,
} from './settingsStorage';

// Vitest runs in Node by default — localStorage isn't defined. Stub a simple
// in-memory implementation so the storage layer has somewhere to read/write.
const memStore: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memStore[k] ?? null,
  setItem: (k: string, v: string) => {
    memStore[k] = v;
  },
  removeItem: (k: string) => {
    delete memStore[k];
  },
  clear: () => {
    for (const k of Object.keys(memStore)) delete memStore[k];
  },
});

// `persistConfigToStorage` reads `serverConfig`, whose lazy init falls back to
// `window.location.origin` when `process.env.SERVER` is unset. A developer's
// `.env.local` sets SERVER, so the fallback is never reached locally — CI has no
// `.env.local` and hit `ReferenceError: window is not defined`. Stubbed here so
// the test states its own environment rather than inheriting one.
vi.stubGlobal('window', { location: { origin: 'http://localhost' } });

describe('settingsStorage — hydrateConfigFromStorage', () => {
  beforeEach(() => {
    clearSettings();
    featureFlags.reset();
  });

  it('ignores deprecated legacyEntriesTable and unifiedEntriesTable values', () => {
    // The legacy split-by-status entries table was removed; the unified
    // table is the only entries table. Stored values for either flag must
    // deserialize cleanly but produce no FeatureFlags entry.
    saveSettings({ legacyEntriesTable: true, unifiedEntriesTable: false });
    hydrateConfigFromStorage();
    const flags = featureFlags.get() as unknown as Record<string, unknown>;
    expect(flags.legacyEntriesTable).toBeUndefined();
    expect(flags.unifiedEntriesTable).toBeUndefined();
  });

  it('ignores deprecated googleSheetsImport and enableChat values', () => {
    // These flags were promoted to standard — stored values should be
    // ignored (they no longer exist on FeatureFlags).
    // enableChat is no longer a TMXSettings field (chat is governed by
    // provider config); cast so the legacy blob still type-checks here.
    saveSettings({ googleSheetsImport: true, enableChat: true } as any);
    hydrateConfigFromStorage();
    const flags = featureFlags.get() as unknown as Record<string, unknown>;
    expect(flags.googleSheetsImport).toBeUndefined();
    expect(flags.enableChat).toBeUndefined();
  });

  it('ignores deprecated legacySchedule and schedule2 values', () => {
    // The legacy schedule tab was removed in TMX 3.3.0; stored values for
    // these flags must deserialize cleanly but produce no FeatureFlags entry.
    saveSettings({ legacySchedule: true, schedule2: false });
    hydrateConfigFromStorage();
    const flags = featureFlags.get() as unknown as Record<string, unknown>;
    expect(flags.legacySchedule).toBeUndefined();
    expect(flags.schedule2).toBeUndefined();
  });

  it('ignores deprecated reports flag (now production-promoted)', () => {
    // Reports tab was promoted to production — its flag no longer exists
    // on FeatureFlags but old localStorage blobs may still carry the field.
    saveSettings({ reports: true });
    hydrateConfigFromStorage();
    const flags = featureFlags.get() as unknown as Record<string, unknown>;
    expect(flags.reports).toBeUndefined();
  });
});

/**
 * The Officials board toggle is a preference, not a feature flag, so it rides in
 * `preferencesConfig` alongside `drawMinimapVisible` rather than in
 * `featureFlags`. It has to survive a reload, and it has to default to OFF —
 * "unchecked by default" is the requirement, and an absent stored value is the
 * case every existing user is in.
 */
describe('settingsStorage — officialsBoard preference', () => {
  beforeEach(() => {
    clearSettings();
    preferencesConfig.reset();
  });

  it('defaults to off when nothing is stored', () => {
    hydrateConfigFromStorage();
    expect(preferencesConfig.get().officialsBoard).toBe(false);
  });

  it('round-trips through localStorage', () => {
    preferencesConfig.set({ officialsBoard: true });
    persistConfigToStorage();

    // The stored blob, not just the in-memory config — this is what the next
    // page load actually reads.
    expect(loadSettings()?.officialsBoard).toBe(true);

    preferencesConfig.reset();
    expect(preferencesConfig.get().officialsBoard, 'the control — reset really cleared it').toBe(false);

    hydrateConfigFromStorage();
    expect(preferencesConfig.get().officialsBoard).toBe(true);
  });

  it('hydrates an explicit false rather than falling back to the default', () => {
    // `false` and "not set" are the same outcome today, but only because the
    // default is off. Hydrating with `!== undefined` rather than truthiness is
    // what keeps a deliberate opt-out from being indistinguishable from silence
    // if that default ever changes.
    preferencesConfig.set({ officialsBoard: true });
    saveSettings({ officialsBoard: false });
    hydrateConfigFromStorage();
    expect(preferencesConfig.get().officialsBoard).toBe(false);
  });

  it('is not a feature flag', () => {
    preferencesConfig.set({ officialsBoard: true });
    persistConfigToStorage();
    hydrateConfigFromStorage();
    const flags = featureFlags.get() as unknown as Record<string, unknown>;
    expect(flags.officialsBoard).toBeUndefined();
  });
});
