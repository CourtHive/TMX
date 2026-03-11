/**
 * Display and UI configuration.
 */
export interface DisplayConfig {
  composition: any;
  tableHeightMultiplier: number;
  printing: { pageSize: string };
}

const defaults: DisplayConfig = {
  composition: undefined,
  tableHeightMultiplier: 0.85,
  printing: { pageSize: 'A4' },
};

let current: DisplayConfig = { ...defaults };

export const displayConfig = {
  get: (): Readonly<DisplayConfig> => current,
  set: (partial: Partial<DisplayConfig>) => {
    current = { ...current, ...partial };
  },
  reset: () => {
    current = { ...defaults };
  },
} as const;
