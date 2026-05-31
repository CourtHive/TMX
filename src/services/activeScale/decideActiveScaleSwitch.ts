/**
 * Decide whether to auto-switch / prompt for the active rating scale
 * based on what's actually present in a loaded tournament.
 *
 * Pure function — no DOM, no storage. The runner module wires the
 * decision to setActiveScale + toast + modal.
 */

export type AutoSwitchAction = 'no-op' | 'switch' | 'prompt';

export interface AutoSwitchDecision {
  action: AutoSwitchAction;
  /** Lowercase scale key currently in `env.activeScale`. */
  fromScale: string;
  /** Lowercase keys of scales the tournament's participants actually carry. */
  availableScales: string[];
  /**
   * Lowercase target when `action === 'switch'`. Undefined for `no-op` and
   * `prompt` — the prompt presents all `availableScales` as choices.
   */
  toScale?: string;
}

export interface DecideInput {
  /** Current active scale (lowercase, e.g. 'wtn'). */
  activeScale: string;
  /**
   * Scale names from `collectAvailableScales()` — UPPERCASE per the factory
   * convention. Order is preserved for downstream UI.
   */
  availableScaleNames: string[];
  /** Has the user already been prompted for this tournament? */
  alreadyAsked: boolean;
}

export function decideActiveScaleSwitch(input: DecideInput): AutoSwitchDecision {
  const fromScale = (input.activeScale || '').toLowerCase();
  const availableScales = (input.availableScaleNames || []).map((s) => String(s).toLowerCase());

  if (availableScales.length === 0) {
    return { action: 'no-op', fromScale, availableScales };
  }
  if (availableScales.includes(fromScale)) {
    return { action: 'no-op', fromScale, availableScales };
  }
  if (availableScales.length === 1) {
    return { action: 'switch', fromScale, availableScales, toScale: availableScales[0] };
  }
  if (input.alreadyAsked) {
    return { action: 'no-op', fromScale, availableScales };
  }
  return { action: 'prompt', fromScale, availableScales };
}
