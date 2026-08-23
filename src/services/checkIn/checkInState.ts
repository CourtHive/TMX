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
 * **The read needs no query.** `addMatchUpContext` already attaches `checkedInParticipantIds` and
 * `allParticipantsCheckedIn` to every hydrated matchUp, so this only has to pair those ids with the
 * individuals they belong to.
 */

export interface CheckInParticipant {
  participantName: string;
  participantId: string;
  sideNumber?: number;
  checkedIn: boolean;
}

export interface MatchUpCheckInState {
  participants: CheckInParticipant[];
  /** Some, but not all, are at the desk — the state the whole feature exists to make visible. */
  hasParticipants: boolean;
  checkedInCount: number;
  allCheckedIn: boolean;
  partial: boolean;
  total: number;
}

const INDIVIDUAL = 'INDIVIDUAL';

/**
 * The individuals who may check in to a matchUp.
 *
 * Mirrors the factory's `getMatchUpParticipantIds` **for display only** — that function is not
 * exported from the package root, so TMX cannot call it. That asymmetry is safe in one direction and
 * only one: `checkInParticipant` validates every write against its own `allRelevantParticipantIds`, so
 * if this derivation missed somebody the menu would be short a row, never able to write a bad id.
 *
 * **The PAIR itself is deliberately excluded, and this is load-bearing (D4c).** The factory's
 * `allRelevantParticipantIds` also contains `sideParticipantIds`, so it would accept a check-in
 * against the PAIR — and nothing reconciles a PAIR-level check-in with its two individual ones. A desk
 * that checked in the pair and a desk that checked in both players would store different state for the
 * same physical fact. Returning only individuals makes the wrong write unreachable from the UI rather
 * than merely discouraged.
 */
function individualsOf(matchUp: any): { participantId: string; participantName: string; sideNumber?: number }[] {
  const individuals: { participantId: string; participantName: string; sideNumber?: number }[] = [];

  for (const side of matchUp?.sides ?? []) {
    const participant = side?.participant;
    if (!participant) continue;
    const { sideNumber } = side;

    // A PAIR or TEAM contributes its members, never itself.
    const nested = participant.individualParticipants;
    if (Array.isArray(nested) && nested.length) {
      for (const member of nested) {
        if (member?.participantId) {
          individuals.push({
            participantId: member.participantId,
            participantName: member.participantName ?? '',
            sideNumber,
          });
        }
      }
      continue;
    }

    if (participant.participantType === INDIVIDUAL && participant.participantId) {
      individuals.push({
        participantId: participant.participantId,
        participantName: participant.participantName ?? '',
        sideNumber,
      });
    }
  }

  return individuals;
}

export function getMatchUpCheckInState(matchUp?: any): MatchUpCheckInState {
  const checkedInIds = new Set<string>(
    Array.isArray(matchUp?.checkedInParticipantIds) ? matchUp.checkedInParticipantIds : [],
  );

  const participants: CheckInParticipant[] = individualsOf(matchUp).map((individual) => ({
    ...individual,
    checkedIn: checkedInIds.has(individual.participantId),
  }));

  const total = participants.length;
  const checkedInCount = participants.filter((participant) => participant.checkedIn).length;

  return {
    participants,
    total,
    checkedInCount,
    hasParticipants: total > 0,
    // `allCheckedIn` is false for a matchUp with nobody in it — "everyone present" is meaningless
    // when there is no one, and reporting true would let the call-to-court gate pass silently.
    allCheckedIn: total > 0 && checkedInCount === total,
    partial: checkedInCount > 0 && checkedInCount < total,
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
