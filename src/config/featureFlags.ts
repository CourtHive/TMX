/**
 * Feature flags — beta toggles persisted to localStorage.
 *
 * Standard features (Google Sheets import, tournament chat, unified entries
 * table, schedule2) are no longer flagged. The remaining flags are in-flight
 * beta features.
 */
export interface FeatureFlags {
  assistant: boolean;
  formatWizard: boolean;
  reports: boolean;
  usePublishState: boolean;
}

const defaults: FeatureFlags = {
  assistant: false,
  formatWizard: false,
  reports: false,
  usePublishState: false,
};

let current: FeatureFlags = { ...defaults };

export const featureFlags = {
  get: (): Readonly<FeatureFlags> => current,
  set: (partial: Partial<FeatureFlags>) => {
    current = { ...current, ...partial };
  },
  reset: () => {
    current = { ...defaults };
  },
} as const;
