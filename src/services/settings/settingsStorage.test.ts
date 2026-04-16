import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hydrateConfigFromStorage, saveSettings, clearSettings } from './settingsStorage';
import { featureFlags } from 'config/featureFlags';

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

describe('settingsStorage — hydrateConfigFromStorage', () => {
  beforeEach(() => {
    clearSettings();
    featureFlags.reset();
  });

  it('applies legacyEntriesTable when stored', () => {
    saveSettings({ legacyEntriesTable: true });
    hydrateConfigFromStorage();
    expect(featureFlags.get().legacyEntriesTable).toBe(true);
  });

  it('leaves legacyEntriesTable at default when nothing is stored', () => {
    hydrateConfigFromStorage();
    expect(featureFlags.get().legacyEntriesTable).toBe(false);
  });

  describe('migration from deprecated unifiedEntriesTable', () => {
    it('migrates unifiedEntriesTable=false into legacyEntriesTable=true', () => {
      // A power user previously opted out of the unified table. That opt-out
      // must survive the promotion / flag rename — they still see the legacy
      // split-by-status panels.
      saveSettings({ unifiedEntriesTable: false });
      hydrateConfigFromStorage();
      expect(featureFlags.get().legacyEntriesTable).toBe(true);
    });

    it('does NOT migrate unifiedEntriesTable=true (that was the default path)', () => {
      saveSettings({ unifiedEntriesTable: true });
      hydrateConfigFromStorage();
      expect(featureFlags.get().legacyEntriesTable).toBe(false);
    });

    it('an explicit new legacyEntriesTable setting takes precedence over legacy unifiedEntriesTable', () => {
      saveSettings({ unifiedEntriesTable: false, legacyEntriesTable: false });
      hydrateConfigFromStorage();
      // The new explicit setting (false) wins over the old implicit migration (true).
      expect(featureFlags.get().legacyEntriesTable).toBe(false);
    });
  });

  it('ignores deprecated googleSheetsImport and enableChat values', () => {
    // These flags were promoted to standard — stored values should be
    // ignored (they no longer exist on FeatureFlags).
    saveSettings({ googleSheetsImport: true, enableChat: true });
    hydrateConfigFromStorage();
    const flags = featureFlags.get() as unknown as Record<string, unknown>;
    expect(flags.googleSheetsImport).toBeUndefined();
    expect(flags.enableChat).toBeUndefined();
  });

  it('applies schedule2 (still a live beta flag)', () => {
    saveSettings({ schedule2: true });
    hydrateConfigFromStorage();
    expect(featureFlags.get().schedule2).toBe(true);
  });
});
