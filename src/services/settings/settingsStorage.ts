/**
 * Settings persistence to localStorage.
 *
 * Manages saving and loading user preferences. During the env→config migration,
 * this module bridges localStorage with the typed config modules. The TMXSettings
 * type and localStorage format remain unchanged for backward compatibility with
 * existing user data.
 */
import { preferencesConfig } from 'config/preferencesConfig';
import { featureFlags } from 'config/featureFlags';
import { serverConfig } from 'config/serverConfig';

const SETTINGS_KEY = 'tmx_settings';

export type TMXSettings = {
  activeScale?: 'wtn' | 'utr';
  scoringApproach?: 'dynamicSets' | 'freeScore' | 'dialPad' | 'inlineScoring';
  saveLocal?: boolean;
  smartComplements?: boolean;
  assistant?: boolean;
  formatWizard?: boolean;
  /**
   * @deprecated — Reports tab has been promoted to production. The icon
   * is always visible; the flag is no longer read. Retained in the type
   * only so existing localStorage blobs deserialize cleanly.
   */
  reports?: boolean;
  /**
   * @deprecated — the legacy split-by-status entries table has been
   * removed. Stored values are ignored on hydrate. Retained in the type
   * only so existing localStorage blobs deserialize cleanly.
   */
  legacyEntriesTable?: boolean;
  /**
   * @deprecated — legacy schedule tab has been removed. Stored values are
   * ignored on hydrate. Retained in the type only so existing localStorage
   * blobs deserialize cleanly.
   */
  legacySchedule?: boolean;
  /**
   * @deprecated — schedule2 is the only schedule tab. Stored values are
   * ignored on hydrate. Retained in the type only so existing localStorage
   * blobs deserialize cleanly.
   */
  schedule2?: boolean;
  /**
   * @deprecated — settings-page panel removed. Grid row count is now
   * persisted as a tournament-scoped `scheduleDisplay` extension via the
   * in-place Rows stepper in the court grid header. Retained in the type
   * only so existing localStorage blobs deserialize cleanly.
   */
  minCourtGridRows?: number;
  language?: string;
  /**
   * True when the user explicitly chose `language` via selectIdiom.
   * Distinguishes "user picked this" from "passively inherited from a
   * provider default". When unset/false, the provider's defaultLanguage
   * overrides on boot. See Mentat/planning/I18N_DELIVERY.md.
   */
  languageExplicit?: boolean;
  theme?: 'light' | 'dark' | 'system';
  fontFamily?: string;
  fontSize?: string;
  /**
   * Selected PDF font: a CFS font-catalog id (e.g. 'dejavu-sans',
   * 'liberation-sans', 'helvetica'), or the sentinel '__provider_default__'
   * (or unset) to follow the provider's defaultPdfFont. Resolved by
   * services/pdf/pdfFont.ts; embedded in generated PDFs for Latin-2 coverage.
   */
  pdfFont?: string;
  /**
   * @deprecated — promoted to standard features. Retained in the type only so
   * existing localStorage values deserialize cleanly; ignored on hydrate.
   */
  googleSheetsImport?: boolean;
  /**
   * @deprecated — promoted to standard features. Retained in the type only so
   * existing localStorage values deserialize cleanly; ignored on hydrate.
   */
  enableChat?: boolean;
  /**
   * @deprecated — unified entries table is now the only entries table.
   * Stored values are ignored on hydrate. Retained in the type only so
   * existing localStorage blobs deserialize cleanly.
   */
  unifiedEntriesTable?: boolean;
  /** Whether the bracket minimap navigator appears on large SE draws. */
  drawMinimapVisible?: boolean;
};

/**
 * Load raw settings from localStorage.
 */
export function loadSettings(): TMXSettings | null {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as TMXSettings;
  } catch (error) {
    console.error('Error loading settings from localStorage:', error);
    return null;
  }
}

/**
 * Save settings to localStorage (merges with existing).
 */
export function saveSettings(settings: TMXSettings): void {
  try {
    const existing = loadSettings() ?? {};
    const merged = { ...existing, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  } catch (error) {
    console.error('Error saving settings to localStorage:', error);
  }
}

/**
 * Clear all settings from localStorage.
 */
export function clearSettings(): void {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch (error) {
    console.error('Error clearing settings from localStorage:', error);
  }
}

/**
 * Hydrate typed config modules from localStorage.
 *
 * Call once at startup (before UI renders). Returns the raw settings
 * so the caller can handle non-config concerns like language and theme.
 */
export function hydrateConfigFromStorage(): TMXSettings | null {
  const settings = loadSettings();
  if (!settings) return null;

  // Server config
  if (settings.saveLocal !== undefined) {
    serverConfig.set({ saveLocal: settings.saveLocal });
  }

  // Preferences
  const prefsPatch: Record<string, any> = {};
  if (settings.activeScale) prefsPatch.activeScale = settings.activeScale;
  if (settings.scoringApproach) prefsPatch.scoringApproach = settings.scoringApproach;
  if (settings.smartComplements !== undefined) prefsPatch.smartComplements = settings.smartComplements;
  if (settings.drawMinimapVisible !== undefined) prefsPatch.drawMinimapVisible = settings.drawMinimapVisible;
  if (Object.keys(prefsPatch).length) {
    preferencesConfig.set(prefsPatch);
  }

  // Feature flags
  const flagsPatch: Record<string, any> = {};
  if (settings.assistant !== undefined) flagsPatch.assistant = settings.assistant;
  if (settings.formatWizard !== undefined) flagsPatch.formatWizard = settings.formatWizard;
  if (Object.keys(flagsPatch).length) {
    featureFlags.set(flagsPatch);
  }

  return settings;
}

/**
 * Persist current config module state to localStorage.
 *
 * Reads from the typed config modules and merges into the existing
 * localStorage blob. Call this after programmatic config changes that
 * should survive a page reload.
 */
export function persistConfigToStorage(
  extras?: Pick<TMXSettings, 'language' | 'languageExplicit' | 'theme' | 'fontFamily' | 'fontSize'>,
): void {
  const prefs = preferencesConfig.get();
  const flags = featureFlags.get();
  const server = serverConfig.get();

  saveSettings({
    activeScale: prefs.activeScale as TMXSettings['activeScale'],
    scoringApproach: prefs.scoringApproach,
    smartComplements: prefs.smartComplements,
    drawMinimapVisible: prefs.drawMinimapVisible,
    saveLocal: server.saveLocal,
    assistant: flags.assistant,
    formatWizard: flags.formatWizard,
    ...extras,
  });
}
