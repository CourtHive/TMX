import { describe, it, expect, beforeEach, vi } from 'vitest';

// Avoid loading the heavy pdf-factory/jsPDF bundle in this unit test; only the
// resolution logic is under test here.
vi.mock('pdf-factory', () => ({ setDefaultFont: () => undefined }));

// Vitest runs in Node by default — localStorage isn't defined. Stub a simple
// in-memory implementation (mirrors settingsStorage.test.ts).
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

import { getSelectedFontId, getCachedFontCatalog, PROVIDER_DEFAULT_FONT } from './pdfFont';
import { providerConfig } from 'config/providerConfig';

const SETTINGS_KEY = 'tmx_settings';
const DEJAVU = 'dejavu-sans';
const LIBERATION = 'liberation-sans';

describe('pdfFont resolution (user → provider → helvetica)', () => {
  beforeEach(() => {
    localStorage.clear();
    providerConfig.reset();
  });

  it('defaults to helvetica when neither user nor provider set a font', () => {
    expect(getSelectedFontId()).toBe('helvetica');
  });

  it('uses the provider default when the user follows it', () => {
    providerConfig.set({ defaults: { defaultPdfFont: LIBERATION } as any });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ pdfFont: PROVIDER_DEFAULT_FONT }));
    expect(getSelectedFontId()).toBe(LIBERATION);
  });

  it('falls back to the provider default when the user has no setting', () => {
    providerConfig.set({ defaults: { defaultPdfFont: DEJAVU } as any });
    expect(getSelectedFontId()).toBe(DEJAVU);
  });

  it('lets an explicit user choice override the provider default', () => {
    providerConfig.set({ defaults: { defaultPdfFont: LIBERATION } as any });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ pdfFont: DEJAVU }));
    expect(getSelectedFontId()).toBe(DEJAVU);
  });
});

describe('pdfFont catalog', () => {
  beforeEach(() => localStorage.clear());

  it('exposes the built-in + Central-European fonts by default', () => {
    const ids = getCachedFontCatalog().map((f) => f.id);
    expect(ids).toContain('helvetica');
    expect(ids).toContain(DEJAVU);
    expect(ids).toContain(LIBERATION);
  });

  it('marks the CE fonts as non-builtin with file URLs', () => {
    const dejavu = getCachedFontCatalog().find((f) => f.id === DEJAVU);
    expect(dejavu?.builtin).toBe(false);
    expect(dejavu?.files?.normal).toBe('/fonts/DejaVuSans.ttf');
  });
});
