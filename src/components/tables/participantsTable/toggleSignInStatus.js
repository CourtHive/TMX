import { mutationRequest } from 'services/mutation/mutationRequest';

import { MODIFY_SIGN_IN_STATUS } from 'constants/mutationConstants';
import { participantConstants } from 'tods-competition-factory';

const { SIGNED_IN, SIGNED_OUT } = participantConstants;

export function toggleSignInStatus(e, cell) {
  const participantId = cell.getRow().getData().participantId;
  const signedIn = !cell.getValue();
  const signInState = signedIn ? SIGNED_IN : SIGNED_OUT;

  const methods = [
    {
      params: { signInState, participantIds: [participantId] },
      method: MODIFY_SIGN_IN_STATUS
    }
  ];
  const postMutation = (result) => {
    if (result.success) {
      cell.setValue(signedIn);
    }
  };
  mutationRequest({ methods, callback: postMutation });
}
