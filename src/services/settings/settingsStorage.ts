/**
 * Settings persistence to localStorage.
 *
 * Manages saving and loading user preferences. During the env→config migration,
 * this module bridges localStorage with the typed config modules. The TMXSettings
 * type and localStorage format remain unchanged for backward compatibility with
 * existing user data.
 */
import { serverConfig } from 'config/serverConfig';
import { featureFlags } from 'config/featureFlags';
import { preferencesConfig } from 'config/preferencesConfig';
import { scheduleConfig } from 'config/scheduleConfig';

const SETTINGS_KEY = 'tmx_settings';

export type TMXSettings = {
  activeScale?: 'wtn' | 'utr';
  scoringApproach?: 'dynamicSets' | 'freeScore' | 'dialPad' | 'inlineScoring';
  saveLocal?: boolean;
  smartComplements?: boolean;
  pdfPrinting?: boolean;
  googleSheetsImport?: boolean;
  schedule2?: boolean;
  enableChat?: boolean;
  minCourtGridRows?: number;
  language?: string;
  theme?: 'light' | 'dark' | 'system';
  fontFamily?: string;
  fontSize?: string;
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
  if (Object.keys(prefsPatch).length) {
    preferencesConfig.set(prefsPatch);
  }

  // Feature flags
  const flagsPatch: Record<string, any> = {};
  if (settings.pdfPrinting !== undefined) flagsPatch.pdfPrinting = settings.pdfPrinting;
  if (settings.googleSheetsImport !== undefined) flagsPatch.googleSheetsImport = settings.googleSheetsImport;
  if (settings.schedule2 !== undefined) flagsPatch.schedule2 = settings.schedule2;
  if (settings.enableChat !== undefined) flagsPatch.enableChat = settings.enableChat;
  if (Object.keys(flagsPatch).length) {
    featureFlags.set(flagsPatch);
  }

  // Schedule config
  if (settings.minCourtGridRows !== undefined) {
    scheduleConfig.set({ minCourtGridRows: settings.minCourtGridRows });
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
export function persistConfigToStorage(extras?: Pick<TMXSettings, 'language' | 'theme' | 'fontFamily' | 'fontSize'>): void {
  const prefs = preferencesConfig.get();
  const flags = featureFlags.get();
  const server = serverConfig.get();
  const schedule = scheduleConfig.get();

  saveSettings({
    activeScale: prefs.activeScale as TMXSettings['activeScale'],
    scoringApproach: prefs.scoringApproach,
    smartComplements: prefs.smartComplements,
    saveLocal: server.saveLocal,
    pdfPrinting: flags.pdfPrinting,
    googleSheetsImport: flags.googleSheetsImport,
    schedule2: flags.schedule2,
    enableChat: flags.enableChat,
    minCourtGridRows: schedule.minCourtGridRows,
    ...extras,
  });
}
