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
  /**
   * Whether the top-level Officials board tab is offered.
   *
   * Off by default: it is a court-side board (who is on court now, who is free,
   * who has been working since 9am) that most providers never staff for, and an
   * always-present tab for a surface nobody uses is clutter. Not a beta flag —
   * the board is finished, this is a choice about whether to show it.
   */
  officialsBoard: boolean;
}

const defaults: PreferencesConfig = {
  activeScale: 'wtn',
  scoringApproach: 'dynamicSets',
  smartComplements: true,
  hotkeys: false,
  scoring: false,
  ioc: 'gbr',
  drawMinimapVisible: true,
  officialsBoard: false,
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
