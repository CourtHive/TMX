import { loadSettings, saveSettings } from 'services/settings/settingsStorage';
import { context } from 'services/context';

type ThemePreference = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'tmx_theme'; // Fast-access key for FOIT script

let mediaQuery: MediaQueryList | null = null;

/**
 * Resolve the effective theme from a preference value.
 */
function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

/**
 * Apply the given theme to the DOM.
 * - Sets `data-theme` on <html> (Bulma reads this)
 * - Toggles `tmx-dark` class on <body> (for custom selectors)
 */
export function applyTheme(pref: ThemePreference): void {
  const theme = resolveTheme(pref);
  document.documentElement.setAttribute('data-theme', theme);
  document.body.classList.toggle('tmx-dark', theme === 'dark');

  // Persist for FOIT prevention script
  localStorage.setItem(THEME_STORAGE_KEY, pref);

  // Persist in TMXSettings
  const settings = loadSettings() ?? {};
  settings.theme = pref;
  saveSettings(settings);

  // Notify live components
  context.ee?.emit('THEME_CHANGE', { theme, preference: pref });
}

/**
 * Initialize theme on app startup. Call from setupTMX().
 */
export function initTheme(): void {
  const settings = loadSettings();
  const pref: ThemePreference = settings?.theme ?? 'light';

  applyTheme(pref);

  // Listen for OS preference changes when in 'system' mode
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const currentPref = loadSettings()?.theme ?? 'light';
    if (currentPref === 'system') {
      applyTheme('system');
    }
  });
}

/**
 * Get the current theme preference.
 */
export function getThemePreference(): ThemePreference {
  return loadSettings()?.theme ?? 'light';
}
