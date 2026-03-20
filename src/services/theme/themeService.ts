import { loadSettings, persistConfigToStorage } from 'services/settings/settingsStorage';
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

export const FONT_SIZE_OPTIONS: Record<string, { label: string; value: string }> = {
  xs: { label: 'Extra Small (13px)', value: '13px' },
  sm: { label: 'Small (14px)', value: '14px' },
  md: { label: 'Medium (16px)', value: '16px' },
  lg: { label: 'Large (18px)', value: '18px' },
  xl: { label: 'Extra Large (20px)', value: '20px' },
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
 * - Sets `data-theme` on <html> (drives CSS variable theming)
 * - Toggles `tmx-dark` class on <body> (for custom selectors)
 */
export function applyTheme(pref: ThemePreference): void {
  const theme = resolveTheme(pref);
  document.documentElement.setAttribute('data-theme', theme);
  document.body.classList.toggle('tmx-dark', theme === 'dark');

  // Persist for FOIT prevention script
  localStorage.setItem(THEME_STORAGE_KEY, pref);

  // Persist in TMXSettings
  persistConfigToStorage({ theme: pref });

  // Notify live components
  context.ee?.emit('THEME_CHANGE', { theme, preference: pref });
}

/**
 * Cycle through theme preferences: light → dark → system → light.
 * Returns the new preference.
 */
export function cycleTheme(): ThemePreference {
  const current = getThemePreference();
  const next: ThemePreference = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
  applyTheme(next);
  return next;
}

/**
 * Get the Font Awesome icon class for the current theme preference.
 */
export function getThemeIcon(pref?: ThemePreference): string {
  const p = pref ?? getThemePreference();
  if (p === 'light') return 'fa-sun';
  if (p === 'dark') return 'fa-moon';
  return 'fa-circle-half-stroke';
}

/**
 * Wire up a navbar icon to cycle through theme preferences on click.
 * Updates the icon class to reflect the current preference.
 */
export function initThemeToggle(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;

  const updateIcon = () => {
    const icon = getThemeIcon();
    el.className = `fa-solid ${icon}`;
    const pref = getThemePreference();
    el.title = pref === 'light' ? 'Light theme' : pref === 'dark' ? 'Dark theme' : 'System theme';
  };

  updateIcon();

  el.addEventListener('click', () => {
    cycleTheme();
    updateIcon();
  });

  // Also update when theme changes from elsewhere (e.g. settings still open in another context)
  context.ee?.on('THEME_CHANGE', () => updateIcon());
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

  // Apply saved font size preference
  const fontSizeKey = settings?.fontSize ?? 'md';
  const fontSizeOption = FONT_SIZE_OPTIONS[fontSizeKey] ?? FONT_SIZE_OPTIONS.md;
  document.documentElement.style.setProperty('--tmx-font-size', fontSizeOption.value);

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

  persistConfigToStorage({ fontFamily: key });
}

/**
 * Apply a font-size to the document by setting --tmx-font-size.
 * Persists the choice in settings.
 */
export function applyFontSize(key: string): void {
  const option = FONT_SIZE_OPTIONS[key] ?? FONT_SIZE_OPTIONS.md;
  document.documentElement.style.setProperty('--tmx-font-size', option.value);

  persistConfigToStorage({ fontSize: key });
}

/**
 * Get the current font preference key.
 */
export function getFontPreference(): string {
  return loadSettings()?.fontFamily ?? 'system';
}

/**
 * Get the current font size preference key.
 */
export function getFontSizePreference(): string {
  return loadSettings()?.fontSize ?? 'md';
}
