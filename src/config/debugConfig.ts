/**
 * Debug and logging configuration.
 */
export interface DebugConfig {
  log: { verbose: boolean };
  renderLog: boolean;
  devNotes: boolean;
  averages: boolean;
}

const defaults: DebugConfig = {
  log: { verbose: false },
  renderLog: false,
  devNotes: false,
  averages: false,
};

let current: DebugConfig = { ...defaults };

export const debugConfig = {
  get: (): Readonly<DebugConfig> => current,
  set: (partial: Partial<DebugConfig>) => {
    current = { ...current, ...partial };
  },
  reset: () => {
    current = { ...defaults };
  },
} as const;
