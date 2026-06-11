/**
 * Timepicker UI configuration.
 *
 * Dev override for the `timepicker-ui` theme. When unset the call sites
 * fall back to the existing auto dark-mode detection
 * (`document.documentElement.dataset.theme === 'dark' ? 'dark' : undefined`).
 *
 * The theme type is derived from the library's own `UIOptions['theme']`
 * so the union auto-widens when the package upgrades (e.g. 4.4.0 adds
 * `blueprint` / `blueprint-dark`).
 *
 * Console usage: `globalThis.dev.env.timepickerTheme = 'cyberpunk'`.
 */
import { UIOptions } from 'timepicker-ui';

export type TimepickerTheme = NonNullable<UIOptions['theme']>;

export interface TimepickerConfig {
  theme?: TimepickerTheme;
}

const defaults: TimepickerConfig = {};

let current: TimepickerConfig = { ...defaults };

export const timepickerConfig = {
  get: (): Readonly<TimepickerConfig> => current,
  set: (partial: Partial<TimepickerConfig>) => {
    current = { ...current, ...partial };
  },
  reset: () => {
    current = { ...defaults };
  },
} as const;
