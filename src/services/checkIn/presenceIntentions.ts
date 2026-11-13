/**
 * Whether this copy holds every presence state a command asked for.
 *
 * `setParticipantCheckInState` carries the direction the operator chose, not a flip. When the server finds
 * that state already held it writes nothing and leaves the directive out of `appliedMethods`, so this copy
 * never replays it (planning/TMX_CHECK_IN_INTENTS_AND_RECONNECT.md, "No-op propagation rule"). Replaying it
 * here could record an attestation the server never held: the server had the state because another desk
 * put it there, and this copy may have missed that desk's frame.
 *
 * So after the server's methods are applied, the requested state must hold here too. If it does not, this
 * copy is behind the server, and the answer is a fresh record, never a resubmitted intention.
 *
 * Only the last intention per person and matchUp counts: a command that checks someone in and then out
 * asked for "out".
 */
import { getMatchUpCheckInState } from 'services/checkIn/checkInState';

import { SET_PARTICIPANT_CHECK_IN_STATE } from 'constants/mutationConstants';

export function presenceIntentionsHeld(factoryEngine: any, methods: any[] = []): boolean {
  const requested = new Map<string, { drawId: string; matchUpId: string; participantId: string; checkedIn: boolean }>();
  for (const directive of methods) {
    if (directive?.method !== SET_PARTICIPANT_CHECK_IN_STATE) continue;
    const { drawId, matchUpId, participantId, checkedIn } = directive.params ?? {};
    requested.set(`${matchUpId}|${participantId}`, { drawId, matchUpId, participantId, checkedIn });
  }

  for (const { drawId, matchUpId, participantId, checkedIn } of requested.values()) {
    const matchUp = factoryEngine.findMatchUp?.({ drawId, matchUpId })?.matchUp;
    const participant = getMatchUpCheckInState(matchUp).participants.find(
      (candidate) => candidate.participantId === participantId,
    );
    if (participant?.checkedIn !== checkedIn) return false;
  }
  return true;
}
