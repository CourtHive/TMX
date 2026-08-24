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
 * **Content only — the gating lives in [`checkInPromptMode`](./checkInPromptMode.ts).** This answers
 * *"who is missing?"*; that answers *"should we interrupt for it?"*. Keeping them apart is what lets
 * the On/Off/Auto decision be unit-tested without a DOM.
 *
 * ⚠️ **This is not consulted by `runAutoCallPass`, and that is deliberate (D4f).** Autocall is
 * timer-driven and batched, so there is nobody standing there to answer a prompt. It calls and marks:
 * the badge carries the incomplete state instead. A silent skip would stall the schedule for a reason
 * no operator can see.
 */

import { getMatchUpCheckInState, awaitingCheckIn } from './checkInState';

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
export function callToCourtPrompt(matchUp?: any): CallToCourtPrompt | null {
  const state = getMatchUpCheckInState(matchUp);
  if (!state.hasParticipants) return null;

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
