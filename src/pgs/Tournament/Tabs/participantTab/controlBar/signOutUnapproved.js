import { tournamentEngine, participantConstants } from 'tods-competition-factory';
import { mutationRequest } from 'services/mutation/mutationRequest';

import { MODIFY_SIGN_IN_STATUS } from 'constants/mutationConstants';

const { INDIVIDUAL, SIGNED_OUT } = participantConstants;

export function signOutUnapproved(replaceTableData) {
  const signedInNoEvents = tournamentEngine
    .getParticipants({
      participantFilters: { participantTypes: [INDIVIDUAL] },
      withSignInStatus: true,
      withEvents: true
    })
    .participants.filter((p) => p.signedIn && !p.events.length);

  const participantIds = signedInNoEvents.map((p) => p.participantId);

  const methods = [
    {
      params: { signInState: SIGNED_OUT, participantIds },
      method: MODIFY_SIGN_IN_STATUS
    }
  ];
  const postMutation = (result) => {
    if (result.success) {
      replaceTableData();
    }
  };
  mutationRequest({ methods, callback: postMutation });
}
