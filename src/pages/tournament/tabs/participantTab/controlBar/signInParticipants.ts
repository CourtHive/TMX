import { mutationRequest } from 'services/mutation/mutationRequest';
import { participantConstants } from 'tods-competition-factory';

import { MODIFY_SIGN_IN_STATUS } from 'constants/mutationConstants';

const { SIGNED_IN } = participantConstants;

export function signInParticipants(table: any): void {
  const selected = table.getSelectedData();
  const participantIds = selected.map(({ participantId }: any) => participantId);

  const methods = [
    {
      params: { signInState: SIGNED_IN, participantIds },
      method: MODIFY_SIGN_IN_STATUS
    }
  ];
  const postMutation = (result: any) => {
    if (result.success) {
      selected.forEach((participant: any) => (participant.signedIn = true));
      table.updateData(selected);
      table.deselectRow();
    }
  };
  mutationRequest({ methods, callback: postMutation });
}
