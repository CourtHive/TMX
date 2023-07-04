import { mutationRequest } from 'services/mutation/mutationRequest';
import { participantConstants } from 'tods-competition-factory';

import { MODIFY_SIGN_IN_STATUS } from 'constants/mutationConstants';

const { SIGNED_IN } = participantConstants;

export function signInParticipants(table) {
  const selected = table.getSelectedData();
  const participantIds = selected.map(({ participantId }) => participantId);

  const methods = [
    {
      params: { signInState: SIGNED_IN, participantIds },
      method: MODIFY_SIGN_IN_STATUS
    }
  ];
  const postMutation = (result) => {
    if (result.success) {
      selected.forEach((participant) => (participant.signedIn = true));
      table.updateData(selected);
      table.deselectRow(); // necessary after data update, not after replaceTableData
    }
  };
  mutationRequest({ methods, callback: postMutation });
}
