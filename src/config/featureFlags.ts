/**
 * Feature flags — beta toggles persisted to localStorage.
 */
export interface FeatureFlags {
  pdfPrinting: boolean;
  googleSheetsImport: boolean;
  schedule2: boolean;
  usePublishState: boolean;
  enableChat: boolean;
}

const defaults: FeatureFlags = {
  pdfPrinting: true,
  googleSheetsImport: false,
  schedule2: false,
  usePublishState: false,
  enableChat: false,
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
