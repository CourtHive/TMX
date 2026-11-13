/**
 * Ask for one individual's check-in state for one matchUp: in or out, as the operator chose.
 *
 * `setParticipantCheckInState` takes the requested state, not a flip. At a desk two operators can be looking at
 * the same row: both see "absent" and both click. A toggle would leave the person absent; an intention leaves
 * them checked in once, with the first arrival's attestation. A request for the state already held changes
 * nothing, and the server leaves it out of what every copy applies (see `presenceIntentions.ts`).
 *
 * The caller captures `checkedIn` at the gesture, from the button the operator pressed, before attribution
 * entry or any asynchronous work. It is never recomputed from the row afterwards, so an old "check in" cannot
 * become a check-out because the row changed while the operator was typing.
 *
 * `drawId`, never a resolved `drawDefinition`: the execution pipeline resolves it (ecosystem rule).
 *
 * ⚠️ `participantId` must be an **INDIVIDUAL**, never a PAIR (D4c). Since factory 7.0.0 the factory
 * refuses anything else in both directions (`INVALID_ATTESTATION_SUBJECT`, #4933(factory)); a side's
 * presence is derived from its individuals on read. `getMatchUpCheckInState` only ever offers
 * individuals, so the desk never asks for a write the factory would refuse.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';

import { SET_PARTICIPANT_CHECK_IN_STATE } from 'constants/mutationConstants';

export function requestCheckInState({
  participantId,
  attributedTo,
  checkedIn,
  matchUpId,
  callback,
  drawId,
}: {
  callback?: (result: any) => void;
  attributedTo?: Record<string, any>;
  participantId: string;
  checkedIn: boolean;
  matchUpId: string;
  drawId: string;
}): void {
  // `attributedTo` names who VOUCHED for the presence — a parent at the desk for a junior — and is
  // omitted entirely when nobody was named. Absent is honest: the factory records no attester rather
  // than synthesising one, and the same is true of records promoted from before attribution existed.
  // A request that changes nothing records no attester either: the first arrival's stays.
  const params: Record<string, any> = { matchUpId, drawId, participantId, checkedIn };
  if (attributedTo) params.attributedTo = attributedTo;

  const methods = [{ method: SET_PARTICIPANT_CHECK_IN_STATE, params }];
  mutationRequest({ methods, callback });
}
