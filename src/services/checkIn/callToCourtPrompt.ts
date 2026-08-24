/**
 * Should calling this matchUp to court warn first, and what does the warning say?
 *
 * **Warn and proceed, never block (D4d).** The desk knows things the record does not — a player who
 * rang ahead, an official who waved them through — and a hard block would teach operators to check
 * everyone in pre-emptively, which destroys the very signal check-in exists to carry.
 *
 * Pure and DOM-free so it gets unit coverage: TMX's suite runs in the vitest `node` environment with
 * no jsdom, so a decision made inside a `confirm()` call site would be untestable. Callers resolve
 * their own hydrated matchUp (the schedule surfaces have a cache for this; a catalog item alone does
 * **not** carry `checkedInParticipantIds`) and supply their own wording — the cell menu and the
 * active-strip drop phrase the question differently because they are different gestures.
 *
 * ⚠️ **This is not consulted by `runAutoCallPass`, and that is deliberate (D4f).** Autocall is
 * timer-driven and batched, so there is nobody standing there to answer a prompt. It calls and marks:
 * the badge carries the incomplete state instead. A silent skip would stall the schedule for a reason
 * no operator can see.
 */

import { getMatchUpCheckInState, awaitingCheckIn } from './checkInState';

export interface CallToCourtPromptOptions {
  /**
   * Suppress the prompt when NOBODY has checked in yet.
   *
   * For a high-frequency gesture — dragging onto the Now strip — a prompt at zero fires on every
   * single drop before the desk has checked anyone in, which at the start of a day is every match,
   * and at a tournament not using check-in at all is every match all week. That is the reflexive
   * dismissal D4d exists to avoid, so the drop asks only when the count is PARTIAL: somebody is
   * demonstrably at the desk for this match and somebody else is not, which is real information.
   *
   * An explicit "Call to court" from the cell menu leaves this off: the operator asked to call this
   * one match, so "nobody is here" is exactly what they need to be told.
   */
  onlyWhenPartial?: boolean;
}

export interface CallToCourtPrompt {
  /** How many of the matchUp's individuals are not yet at the desk. Always ≥ 1. */
  awaitingCount: number;
  /** Their names, comma-joined, for the body of the prompt. */
  names: string;
}

/**
 * Returns null when the call needs no warning — either everyone is checked in, or the matchUp has no
 * participants who could check in (an unfilled draw position).
 */
export function callToCourtPrompt(matchUp?: any, options: CallToCourtPromptOptions = {}): CallToCourtPrompt | null {
  const state = getMatchUpCheckInState(matchUp);
  if (!state.hasParticipants) return null;
  if (options.onlyWhenPartial && state.checkedInCount === 0) return null;

  const awaiting = awaitingCheckIn(state);
  if (!awaiting.length) return null;

  return {
    awaitingCount: awaiting.length,
    names: awaiting
      .map((participant) => participant.participantName)
      .filter(Boolean)
      .join(', '),
  };
}
