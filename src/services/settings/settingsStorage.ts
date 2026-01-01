/**
 * Settings persistence to localStorage
 * Manages saving and loading user preferences
 */

const SETTINGS_KEY = 'tmx_settings';

export type TMXSettings = {
  activeScale?: 'wtn' | 'utr';
  scoringApproach?: 'dynamicSets' | 'freeText' | 'dialPad';
  saveLocal?: boolean;
};

/**
 * Load settings from localStorage
 */
export function loadSettings(): TMXSettings | null {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return null;
    
    const settings = JSON.parse(stored) as TMXSettings;
    console.log('Loaded settings from localStorage:', settings);
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
    console.log('Saved settings to localStorage:', settings);
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
    console.log('Cleared settings from localStorage');
  } catch (error) {
    console.error('Error clearing settings from localStorage:', error);
  }
}
