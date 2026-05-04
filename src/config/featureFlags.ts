/**
 * Feature flags — beta toggles persisted to localStorage.
 *
 * Standard features (Google Sheets import, tournament chat, unified entries
 * table, schedule2) are no longer flagged. The remaining flags are either
 * in-flight beta features or fallback toggles for power users.
 */
export interface FeatureFlags {
  assistant: boolean;
  formatWizard: boolean;
  reports: boolean;
  usePublishState: boolean;
  /**
   * Power-user fallback: render the legacy split-by-status entries table
   * instead of the standard unified entries table. Kept as an escape hatch
   * while the unified table beds in. Default: false.
   */
  legacyEntriesTable: boolean;
  /**
   * Power-user fallback: expose the original schedule tab in navigation.
   * The new schedule (schedule2) is now the default; this flag re-enables
   * the legacy tab as an escape hatch. Default: false.
   */
  legacySchedule: boolean;
}

const defaults: FeatureFlags = {
  assistant: false,
  formatWizard: false,
  reports: false,
  usePublishState: false,
  legacyEntriesTable: false,
  legacySchedule: false,
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
