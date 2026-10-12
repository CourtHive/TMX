/**
 * Flip one individual's check-in state for one matchUp.
 *
 * `toggleParticipantCheckInState` reads the matchUp's current `checkedInParticipantIds` and dispatches
 * to `checkInParticipant` / `checkOutParticipant` itself, so the client never has to decide which
 * direction it is going — which matters at a desk, where two operators can be looking at the same row.
 *
 * `drawId`, never a resolved `drawDefinition`: the execution pipeline resolves it (ecosystem rule).
 *
 * ⚠️ `participantId` must be an **INDIVIDUAL**, never a PAIR (D4c). Since factory 7.0.0 the factory
 * refuses anything else in both directions (`INVALID_ATTESTATION_SUBJECT`, #4933(factory)); a side's
 * presence is derived from its individuals on read. `getMatchUpCheckInState` only ever offers
 * individuals, so the desk never asks for a write the factory would refuse.
 *
 * ⚠️ `toggleParticipantCheckInState` also declares `matchUpIds?: string[]` in its args type and never
 * reads it. Do not pass it expecting to check somebody into several matchUps at once.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';

import { TOGGLE_PARTICIPANT_CHECK_IN_STATE } from 'constants/mutationConstants';

export function toggleCheckIn({
  participantId,
  attributedTo,
  matchUpId,
  callback,
  drawId,
}: {
  callback?: (result: any) => void;
  attributedTo?: Record<string, any>;
  participantId: string;
  matchUpId: string;
  drawId: string;
}): void {
  // `attributedTo` names who VOUCHED for the presence — a parent at the desk for a junior — and is
  // omitted entirely when nobody was named. Absent is honest: the factory records no attester rather
  // than synthesising one, and the same is true of records promoted from before attribution existed.
  //
  // It rides on the toggle rather than on a separate call because a check-out is also an attested
  // fact, and `toggleParticipantCheckInState` is what decides which direction this is going.
  const params: Record<string, any> = { matchUpId, drawId, participantId };
  if (attributedTo) params.attributedTo = attributedTo;

  const methods = [{ method: TOGGLE_PARTICIPANT_CHECK_IN_STATE, params }];
  mutationRequest({ methods, callback });
}
