/**
 * When should calling a matchUp to court interrupt the operator?
 *
 * Three modes, named for operator **intent** rather than for the mechanism behind them (CA,
 * 2026-08-24). "heuristic" would have leaked the implementation into a control and asked the desk to
 * reason about our inference rules.
 *
 * | mode | behaviour |
 * |---|---|
 * | `off` | never prompt. **The default.** |
 * | `auto` | prompt only when check-in is demonstrably in use on the viewed date |
 * | `on` | always prompt when somebody has not checked in |
 *
 * **Why `off` is the default.** Most tournaments do not run a check-in desk at all, and for them any
 * prompt is pure interruption. The feature therefore ships dark and is opted into — CA: *"Auto is for
 * the curious to explore our deep capabilities."* `off` silences **both** call sites, including the
 * cell-menu warn that shipped unconditionally in #1340.
 *
 * **`off` means "do not interrupt me", not "show me nothing".** The `1/2` badge is never gated by
 * this mode. It is already self-gating: it renders only once somebody has checked in, which only
 * happens at a desk that is using check-in. A passive marker costs an operator nothing.
 *
 * Pure and DOM-free — TMX has no jsdom, so a decision made at a `confirm()` call site is untestable.
 */

export type CheckInPromptMode = 'off' | 'auto' | 'on';

/** Cycle order for the toggle: the two definite answers first, then the clever one. */
export const CHECK_IN_PROMPT_MODES: CheckInPromptMode[] = ['off', 'on', 'auto'];

export const DEFAULT_CHECK_IN_PROMPT_MODE: CheckInPromptMode = 'off';

export function isCheckInPromptMode(value: unknown): value is CheckInPromptMode {
  return value === 'off' || value === 'auto' || value === 'on';
}

/**
 * Is check-in actually being used on this date?
 *
 * **Tournament-scoped on purpose, and DATE-scoped within that.** "Is this desk running a check-in
 * table?" is a fact about operating practice, not about any one match — which is exactly why the
 * per-matchUp rule this replaces was silent at `0/2`, the most alarming state at a desk that does
 * use check-in.
 *
 * Scoping to the viewed date rather than the whole tournament is load-bearing: an unfiltered read
 * would arm prompts on Tuesday because somebody checked in on Monday. It also handles "check-in on
 * finals day but not qualifying" for free.
 *
 * Known limitation, accepted rather than designed around: a tournament running check-in for juniors
 * but not for a concurrent adult event arms prompts for both. Scoping to the event would fix it and
 * costs more than the misfire is worth.
 */
export function checkInInUse(matchUps: any[] | undefined, scheduledDate?: string): boolean {
  if (!Array.isArray(matchUps)) return false;

  return matchUps.some((matchUp) => {
    if (scheduledDate && matchUp?.schedule?.scheduledDate !== scheduledDate) return false;
    return Boolean(matchUp?.checkedInParticipantIds?.length);
  });
}

export interface PromptDecision {
  mode: CheckInPromptMode;
  /** Whether check-in is in use on the viewed date. Ignored unless the mode is `auto`. */
  inUse: boolean;
  /** How many individuals have not checked in. Zero means there is nothing to say. */
  awaitingCount: number;
}

/** Whether to interrupt before stamping `calledAt`. */
export function shouldPromptOnCall({ mode, inUse, awaitingCount }: PromptDecision): boolean {
  if (awaitingCount <= 0) return false;
  if (mode === 'off') return false;
  if (mode === 'on') return true;
  return inUse;
}
