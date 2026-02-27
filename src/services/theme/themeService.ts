import { loadSettings, saveSettings } from 'services/settings/settingsStorage';
import { context } from 'services/context';

type ThemePreference = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'tmx_theme'; // Fast-access key for FOIT script

type FontOption = {
  label: string;
  value: string;
  /** Google Fonts family name — omit for system/locally-available fonts */
  googleFont?: string;
};

export const FONT_OPTIONS: Record<string, FontOption> = {
  system: {
    label: 'System (default)',
    value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, 'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  inter: {
    label: 'Inter',
    value: "'Inter', system-ui, -apple-system, sans-serif",
    googleFont: 'Inter:wght@400;500;600;700',
  },
  poppins: {
    label: 'Poppins',
    value: "'Poppins', sans-serif",
    googleFont: 'Poppins:wght@400;500;600;700',
  },
  lato: {
    label: 'Lato',
    value: "'Lato', sans-serif",
    googleFont: 'Lato:wght@400;700',
  },
  'roboto': {
    label: 'Roboto',
    value: "'Roboto', sans-serif",
    googleFont: 'Roboto:wght@400;500;700',
  },
  'open-sans': {
    label: 'Open Sans',
    value: "'Open Sans', sans-serif",
    googleFont: 'Open+Sans:wght@400;600;700',
  },
  'source-sans': {
    label: 'Source Sans 3',
    value: "'Source Sans 3', sans-serif",
    googleFont: 'Source+Sans+3:wght@400;600;700',
  },
  'nunito': {
    label: 'Nunito',
    value: "'Nunito', sans-serif",
    googleFont: 'Nunito:wght@400;600;700',
  },
};

/** Track which fonts have already been injected so we don't add duplicate <link> tags. */
const loadedFonts = new Set<string>();

/**
 * Inject a Google Fonts <link> for on-demand loading.
 * Uses display=swap so text renders immediately in a fallback font,
 * then swaps to the web font once downloaded.
 */
function loadGoogleFont(option: FontOption): void {
  if (!option.googleFont || loadedFonts.has(option.googleFont)) return;
  loadedFonts.add(option.googleFont);

  // Preconnect (idempotent — browser deduplicates)
  if (!document.querySelector('link[href="https://fonts.gstatic.com"]')) {
    const preconnect = document.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = 'https://fonts.gstatic.com';
    preconnect.crossOrigin = '';
    document.head.appendChild(preconnect);
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${option.googleFont}&display=swap`;
  document.head.appendChild(link);
}

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
 * Initialize theme and font on app startup. Call from setupTMX().
 */
export function initTheme(): void {
  const settings = loadSettings();
  const pref: ThemePreference = settings?.theme ?? 'dark';

  applyTheme(pref);

  // Apply saved font preference (loads web font on demand if needed)
  const fontKey = settings?.fontFamily ?? 'system';
  const fontOption = FONT_OPTIONS[fontKey] ?? FONT_OPTIONS.system;
  loadGoogleFont(fontOption);
  document.documentElement.style.setProperty('--tmx-font-family', fontOption.value);

  // Listen for OS preference changes when in 'system' mode
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const currentPref = loadSettings()?.theme ?? 'dark';
    if (currentPref === 'system') {
      applyTheme('system');
    }
  });
}

/**
 * Get the current theme preference.
 */
export function getThemePreference(): ThemePreference {
  return loadSettings()?.theme ?? 'dark';
}

/**
 * Apply a font-family to the document by setting --tmx-font-family.
 * Loads the web font on demand if needed, then persists the choice.
 */
export function applyFont(key: string): void {
  const option = FONT_OPTIONS[key] ?? FONT_OPTIONS.system;
  loadGoogleFont(option);
  document.documentElement.style.setProperty('--tmx-font-family', option.value);

  const settings = loadSettings() ?? {};
  settings.fontFamily = key;
  saveSettings(settings);
}

/**
 * Get the current font preference key.
 */
export function getFontPreference(): string {
  return loadSettings()?.fontFamily ?? 'system';
}
