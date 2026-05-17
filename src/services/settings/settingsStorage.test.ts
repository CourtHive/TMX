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
    saveSettings({ googleSheetsImport: true, enableChat: true });
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
