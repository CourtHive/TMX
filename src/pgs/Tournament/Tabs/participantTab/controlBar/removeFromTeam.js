import { mutationRequest } from 'services/mutation/mutationRequest';

import { REMOVE_INDIVIDUAL_PARTICIPANT_IDS } from 'constants/mutationConstants';

export function removeFromTeam({ table, team }) {
  const selected = table.getSelectedData();
  const individualParticipantIds = selected.map(({ participantId }) => participantId);
  table.deselectRow();
  const methods = [
    {
      method: REMOVE_INDIVIDUAL_PARTICIPANT_IDS,
      params: {
        groupingParticipantId: team.participantId,
        individualParticipantIds,
        suppressErrors: true
      }
    }
  ];
  const postMutation = (result) => {
    if (result.success) {
      table.deleteRow(individualParticipantIds);
    }
  };
  mutationRequest({ methods, callback: postMutation });
}
