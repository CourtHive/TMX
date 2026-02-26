/**
 * Settings persistence to localStorage
 * Manages saving and loading user preferences
 */

const SETTINGS_KEY = 'tmx_settings';

export type TMXSettings = {
  activeScale?: 'wtn' | 'utr';
  scoringApproach?: 'dynamicSets' | 'freeScore' | 'dialPad';
  saveLocal?: boolean;
  smartComplements?: boolean; // Enable smart complement entry in dynamicSets (default: false)
  pdfPrinting?: boolean; // Beta feature flag for PDF generation
  minCourtGridRows?: number; // Minimum schedule grid rows (default: 10)
  persistInputFields?: boolean; // Keep input fields visible after participant assignment (default: true)
  language?: string; // UI language code (e.g. 'en', 'fr')
  theme?: 'light' | 'dark' | 'system'; // UI theme preference
  fontFamily?: string; // CSS font-family override (stored as option key, e.g. 'system', 'inter')
};

/**
 * Load settings from localStorage
 */
export function loadSettings(): TMXSettings | null {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return null;
    
    const settings = JSON.parse(stored) as TMXSettings;
    return settings;
  } catch (error) {
    console.error('Error loading settings from localStorage:', error);
    return null;
  }
}

/**
 * Save settings to localStorage
 */
export function saveSettings(settings: TMXSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings to localStorage:', error);
  }
}

/**
 * Clear all settings from localStorage
 */
export function clearSettings(): void {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch (error) {
    console.error('Error clearing settings from localStorage:', error);
  }
}
