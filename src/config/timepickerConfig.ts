/**
 * Timepicker UI configuration.
 *
 * Dev override for the `timepicker-ui` theme. When unset the call sites
 * fall back to the mode-appropriate blueprint default
 * (`blueprint` in light mode, `blueprint-dark` in dark mode), resolved
 * via `resolveTimepickerTheme()` so both call sites stay in sync.
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

/**
 * Resolve the effective theme for a timepicker instance.
 *
 * Precedence: dev override -> mode-appropriate blueprint default.
 *
 * `blueprint` / `blueprint-dark` were added in timepicker-ui 4.4.0; the
 * fallback is held as a `string` and cast through the library's `theme`
 * type so this compiles against any 4.x `.d.ts` still in node_modules
 * (the runtime value is valid as soon as 4.4.0 is installed).
 */
export function resolveTimepickerTheme(): TimepickerTheme {
  const override = timepickerConfig.get().theme;
  if (override) return override;
  const dark = document.documentElement.dataset.theme === 'dark';
  const fallback: string = dark ? 'blueprint-dark' : 'blueprint';
  return fallback as TimepickerTheme;
}
