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
  schedulePlan: boolean;
  /** Linked Tournaments panel in the tournament settings tab. */
  linkedTournaments: boolean;
  usePublishState: boolean;
  /** Demo-mode lockdown simulator (avatar menu). Off by default. */
  demoMode: boolean;
  /**
   * Score a matchUp with courthive-components' `openScoreEntryDialog` (one model under Dynamic Sets,
   * Dial Pad and Free Score; reports an engine-ready outcome) instead of the shipped scoring modal.
   *
   * ON by default — CA, 2026-10-08: *"just make the beta for score entry modal automatically checked by
   * default for now."* The old modal stays in the build: unticking the box in Settings → Beta features is
   * the fallback, and an operator's stored choice (either way) still wins over this default.
   */
  scoreEntryDialog: boolean;
}

const defaults: FeatureFlags = {
  assistant: false,
  formatWizard: false,
  schedulePlan: false,
  linkedTournaments: false,
  usePublishState: false,
  demoMode: false,
  scoreEntryDialog: true,
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
