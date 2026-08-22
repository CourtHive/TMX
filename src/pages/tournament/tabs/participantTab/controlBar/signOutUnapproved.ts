import { participantConstants, participantRoles } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'services/factory/engine';

import { MODIFY_SIGN_IN_STATUS } from 'constants/mutationConstants';

const { INDIVIDUAL, SIGNED_OUT } = participantConstants;
const { COMPETITOR } = participantRoles;

export function signOutUnapproved(replaceTableData: () => void): void {
  // COMPETITOR-only is load-bearing, not a refinement. "Signed in with no events" is the definition of
  // an official, a coach or a volunteer — none of them ever hold an event entry — so without the role
  // filter this action signed out the entire personnel roster in one click. It is reachable from the
  // Officials and Staff views, where that is the only thing it could possibly have done.
  const signedInNoEvents = (
    tournamentEngine.getParticipants({
      participantFilters: { participantTypes: [INDIVIDUAL as any], participantRoles: [COMPETITOR as any] },
      withSignInStatus: true,
      withEvents: true,
    }).participants ?? []
  ).filter((p: any) => p.signedIn && !p.events.length);

  const participantIds = signedInNoEvents.map((p: any) => p.participantId);

  const methods = [
    {
      params: { signInState: SIGNED_OUT, participantIds },
      method: MODIFY_SIGN_IN_STATUS,
    },
  ];
  const postMutation = (result: any) => {
    if (result.success) {
      replaceTableData();
    }
  };
  mutationRequest({ methods, callback: postMutation });
}
