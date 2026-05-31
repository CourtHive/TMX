/**
 * User preferences — persisted to localStorage via settingsStorage.
 */
export interface PreferencesConfig {
  activeScale: string;
  scoringApproach: 'dynamicSets' | 'freeScore' | 'dialPad' | 'inlineScoring';
  smartComplements: boolean;
  hotkeys: boolean;
  scoring: boolean;
  ioc: string;
  drawMinimapVisible: boolean;
}

const defaults: PreferencesConfig = {
  activeScale: 'wtn',
  scoringApproach: 'dynamicSets',
  smartComplements: true,
  hotkeys: false,
  scoring: false,
  ioc: 'gbr',
  drawMinimapVisible: true,
};

let current: PreferencesConfig = { ...defaults };

export const preferencesConfig = {
  get: (): Readonly<PreferencesConfig> => current,
  set: (partial: Partial<PreferencesConfig>) => {
    current = { ...current, ...partial };
  },
  reset: () => {
    current = { ...defaults };
  },
} as const;
