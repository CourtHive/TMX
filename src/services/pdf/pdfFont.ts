/**
 * PDF font resolution + pre-cache.
 *
 * Resolves which font generated PDFs should embed — user setting → provider
 * default → built-in helvetica — and makes it available to pdf-factory via its
 * module-level `setDefaultFont`, so EVERY print type picks it up without any
 * per-call wiring.
 *
 * Fonts (TrueType) are hosted by competition-factory-server at `/fonts`. We fetch
 * the chosen font once, base64-encode it, and cache it in IndexedDB (Dexie
 * `pdfFonts` table) so subsequent prints are instant and work offline.
 *
 * See Mentat/planning/PDF_CE_FONT_SUPPORT.md (WS-3).
 */

import { setDefaultFont } from 'pdf-factory';
import type { FontDefinition } from 'pdf-factory';

import { baseApi } from 'services/apis/baseApi';
import { tmx2db } from 'services/storage/tmx2db';
import { loadSettings } from 'services/settings/settingsStorage';
import { providerConfig } from 'config/providerConfig';

// constants and types
export const PROVIDER_DEFAULT_FONT = '__provider_default__';
const BUILTIN_FONT_ID = 'helvetica';
const CATALOG_STORAGE_KEY = 'tmx_pdf_font_catalog';
const FONTS_TABLE = 'pdfFonts';

export interface FontStyleUrls {
  normal: string;
  bold?: string;
  italic?: string;
  bolditalic?: string;
}

export interface PdfFontCatalogEntry {
  id: string;
  label: string;
  languages: string[];
  builtin: boolean;
  files?: FontStyleUrls;
}

const CENTRAL_EUROPEAN = ['en', 'cs', 'sk', 'pl', 'hu', 'hr', 'sl', 'ro', 'de', 'fr', 'es', 'it', 'tr'];

// Stable fallback catalog matching what CFS seeds, so the feature works before
// (or without) a successful `/fonts` fetch — the file URLs are stable.
const DEFAULT_CATALOG: PdfFontCatalogEntry[] = [
  { id: BUILTIN_FONT_ID, label: 'Helvetica (built-in)', languages: ['en'], builtin: true },
  {
    id: 'dejavu-sans',
    label: 'DejaVu Sans',
    languages: CENTRAL_EUROPEAN,
    builtin: false,
    files: { normal: '/fonts/files/DejaVuSans.ttf', bold: '/fonts/files/DejaVuSans-Bold.ttf' },
  },
  {
    id: 'liberation-sans',
    label: 'Liberation Sans',
    languages: CENTRAL_EUROPEAN,
    builtin: false,
    files: { normal: '/fonts/files/LiberationSans-Regular.ttf', bold: '/fonts/files/LiberationSans-Bold.ttf' },
  },
];

let catalogCache: PdfFontCatalogEntry[] | undefined;

/** Catalog from memory → localStorage → built-in defaults (always non-empty). */
export function getCachedFontCatalog(): PdfFontCatalogEntry[] {
  if (catalogCache?.length) return catalogCache;
  try {
    const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PdfFontCatalogEntry[]) : undefined;
    if (parsed?.length) {
      catalogCache = parsed;
      return parsed;
    }
  } catch (err) {
    console.warn('[pdfFont] failed to read cached catalog:', err);
  }
  return DEFAULT_CATALOG;
}

/** Refresh the catalog from CFS `/fonts`; falls back to the cached/default list. */
export async function fetchFontCatalog(): Promise<PdfFontCatalogEntry[]> {
  try {
    const { data } = await baseApi.get('/fonts', { silenceErrors: true } as any);
    const fonts = data?.fonts as PdfFontCatalogEntry[] | undefined;
    if (fonts?.length) {
      catalogCache = fonts;
      localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(fonts));
      return fonts;
    }
  } catch (err) {
    console.warn('[pdfFont] catalog fetch failed; using cached/default:', err);
  }
  return getCachedFontCatalog();
}

/** The font id to use: explicit user choice → provider default → built-in. */
export function getSelectedFontId(): string {
  const userChoice = loadSettings()?.pdfFont;
  if (userChoice && userChoice !== PROVIDER_DEFAULT_FONT) return userChoice;
  const providerDefault = (providerConfig.get().defaults as any)?.defaultPdfFont as string | undefined;
  return providerDefault || BUILTIN_FONT_ID;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }
  return btoa(chunks.join(''));
}

async function fetchFontBase64(url: string): Promise<string> {
  const { data } = await baseApi.get(url, { responseType: 'arraybuffer', silenceErrors: true } as any);
  return arrayBufferToBase64(data as ArrayBuffer);
}

function familyFromId(id: string): string {
  return id.replaceAll(/[^A-Za-z0-9]/g, '') || 'PdfFont';
}

async function readCachedFont(id: string): Promise<FontDefinition | undefined> {
  try {
    const cached = await tmx2db.findUnique(FONTS_TABLE, 'fontId', id);
    if (cached?.normal) return { family: cached.family, normal: cached.normal, bold: cached.bold };
  } catch (err) {
    console.warn('[pdfFont] cache read failed:', err);
  }
  return undefined;
}

async function cacheFont(id: string, def: FontDefinition): Promise<void> {
  try {
    await tmx2db.addItem(FONTS_TABLE, { fontId: id, ...def, cachedAt: Date.now() });
  } catch (err) {
    console.warn('[pdfFont] cache write failed:', err);
  }
}

/** Resolve a catalog entry to an embeddable FontDefinition (cached or fetched). */
async function loadFontDefinition(entry: PdfFontCatalogEntry): Promise<FontDefinition | undefined> {
  if (entry.builtin || !entry.files?.normal) return undefined;

  const cached = await readCachedFont(entry.id);
  if (cached) return cached;

  const normal = await fetchFontBase64(entry.files.normal);
  const bold = entry.files.bold ? await fetchFontBase64(entry.files.bold) : undefined;
  const def: FontDefinition = { family: familyFromId(entry.id), normal, bold };
  await cacheFont(entry.id, def);
  return def;
}

function findCatalogEntry(id: string): PdfFontCatalogEntry | undefined {
  return getCachedFontCatalog().find((f) => f.id === id);
}

/**
 * Resolve the active PDF font and install it as pdf-factory's default so all
 * generators embed it. Falls back to the built-in helvetica (clears the default)
 * on the built-in id or any failure. Safe to call repeatedly; cached after first.
 */
export async function ensurePdfFontReady(): Promise<void> {
  const id = getSelectedFontId();
  if (!id || id === BUILTIN_FONT_ID) {
    setDefaultFont(undefined);
    return;
  }
  const entry = findCatalogEntry(id);
  if (!entry || entry.builtin) {
    setDefaultFont(undefined);
    return;
  }
  try {
    setDefaultFont(await loadFontDefinition(entry));
  } catch (err) {
    console.warn('[pdfFont] failed to load font; falling back to helvetica:', err);
    setDefaultFont(undefined);
  }
}

/**
 * Boot/login entry point: warm the catalog (for the settings picker) and apply
 * the resolved font. Fire-and-forget; never throws.
 */
export async function initPdfFont(): Promise<void> {
  await fetchFontCatalog();
  await ensurePdfFontReady();
}
