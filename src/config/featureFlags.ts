/**
 * Feature flags — beta toggles persisted to localStorage.
 *
 * Standard features (Google Sheets import, tournament chat, unified entries
 * table) are no longer flagged. The remaining flags are either in-flight
 * beta features (schedule2) or fallback toggles for power users.
 */
export interface FeatureFlags {
  reports: boolean;
  schedule2: boolean;
  usePublishState: boolean;
  /**
   * Power-user fallback: render the legacy split-by-status entries table
   * instead of the standard unified entries table. Kept as an escape hatch
   * while the unified table beds in. Default: false.
   */
  legacyEntriesTable: boolean;
}

const defaults: FeatureFlags = {
  reports: false,
  schedule2: false,
  usePublishState: false,
  legacyEntriesTable: false,
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
