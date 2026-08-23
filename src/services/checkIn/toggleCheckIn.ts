/**
 * Flip one individual's check-in state for one matchUp.
 *
 * `toggleParticipantCheckInState` reads the matchUp's current `checkedInParticipantIds` and dispatches
 * to `checkInParticipant` / `checkOutParticipant` itself, so the client never has to decide which
 * direction it is going — which matters at a desk, where two operators can be looking at the same row.
 *
 * `drawId`, never a resolved `drawDefinition`: the execution pipeline resolves it (ecosystem rule).
 *
 * ⚠️ `participantId` must be an **INDIVIDUAL**, never a PAIR (D4c). The factory would accept a PAIR —
 * its `allRelevantParticipantIds` includes `sideParticipantIds` — and nothing reconciles a PAIR-level
 * check-in with its two individual ones. `getMatchUpCheckInState` only ever offers individuals, which
 * is what keeps that unreachable rather than merely discouraged.
 *
 * ⚠️ `toggleParticipantCheckInState` also declares `matchUpIds?: string[]` in its args type and never
 * reads it. Do not pass it expecting to check somebody into several matchUps at once.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';

import { TOGGLE_PARTICIPANT_CHECK_IN_STATE } from 'constants/mutationConstants';

export function toggleCheckIn({
  participantId,
  matchUpId,
  callback,
  drawId,
}: {
  callback?: (result: any) => void;
  participantId: string;
  matchUpId: string;
  drawId: string;
}): void {
  const methods = [{ method: TOGGLE_PARTICIPANT_CHECK_IN_STATE, params: { matchUpId, drawId, participantId } }];
  mutationRequest({ methods, callback });
}
