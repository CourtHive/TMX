/**
 * Who has presented themselves at the desk for THIS matchUp.
 *
 * **Not the same thing as signing in.** `signInStatus` is first arrival at the tournament, is
 * tournament-wide, and lives on the participant. Check-in is per-matchUp, lives on the matchUp as a
 * `CHECK_IN` timeItem carrying the participantId, and is what a desk operator manages when several
 * matchUps are scheduled at 12:00 (D4a — the two never share a control).
 *
 * Pure and DOM-free: TMX's unit suite runs in the vitest `node` environment with no jsdom, so the
 * decisions live here and the rendering stays a thin shell.
 *
 * **The factory answers it.** `getMatchUpCheckInState` (factory, after 7.11.0) pairs the individuals who may
 * check in with who has, from the same rules the writes enforce, so TMX no longer re-derives who belongs
 * to a side. This wrapper only reshapes a refusal into an empty state and adds `hasParticipants`.
 */

import { matchUpGovernor } from 'tods-competition-factory';

export interface CheckInParticipant {
  participantName: string;
  participantId: string;
  sideNumber?: number;
  checkedIn: boolean;
}

export interface MatchUpCheckInState {
  participants: CheckInParticipant[];
  hasParticipants: boolean;
  checkedInCount: number;
  allCheckedIn: boolean;
  /** Some, but not all, are at the desk — the state the whole feature exists to make visible. */
  partial: boolean;
  total: number;
}

/**
 * Takes a HYDRATED matchUp (`inContext`), which every caller has: the popover re-reads it from the
 * engine and the schedule surfaces take it from their cache.
 *
 * Each person is an INDIVIDUAL: a PAIR or TEAM side contributes its members, never itself (D4c), which
 * the factory has enforced on writes since 7.0.0 (`INVALID_ATTESTATION_SUBJECT`). `allCheckedIn` is false
 * for a matchUp with nobody in it, so the call-to-court gate cannot pass silently on an empty matchUp.
 */
export function getMatchUpCheckInState(matchUp?: any): MatchUpCheckInState {
  const result: any = matchUp ? matchUpGovernor.getMatchUpCheckInState({ matchUp }) : undefined;
  const participants: CheckInParticipant[] = (result?.participants ?? []).map((participant: any) => ({
    ...participant,
    participantName: participant.participantName ?? '',
  }));
  const total = participants.length;

  return {
    participants,
    total,
    hasParticipants: total > 0,
    checkedInCount: result?.checkedInCount ?? 0,
    allCheckedIn: !!result?.allCheckedIn,
    partial: !!result?.partial,
  };
}

/**
 * `1/2`, never a tick.
 *
 * A boolean collapses the two states a desk is actually distinguishing — "nobody has arrived" and "one
 * of the doubles partners is standing here" — which is the whole reason per-matchUp check-in is worth
 * surfacing at all.
 */
export function checkInSummary(state: MatchUpCheckInState): string {
  return `${state.checkedInCount}/${state.total}`;
}

/** The individuals who are NOT at the desk — what a call-to-court warning has to name. */
export function awaitingCheckIn(state: MatchUpCheckInState): CheckInParticipant[] {
  return state.participants.filter((participant) => !participant.checkedIn);
}
