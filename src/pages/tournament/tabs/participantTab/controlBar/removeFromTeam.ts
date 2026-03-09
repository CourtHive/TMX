import { mutationRequest } from 'services/mutation/mutationRequest';

import { REMOVE_INDIVIDUAL_PARTICIPANT_IDS } from 'constants/mutationConstants';

export function removeFromTeam({ table, team }: { table: any; team: any }): void {
  const activeIds = new Set(table.getData('active').map((a: any) => a.participantId));
  const selected = table.getSelectedData().filter((s: any) => activeIds.has(s.participantId));
  const individualParticipantIds = selected.map(({ participantId }: any) => participantId);
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
  const postMutation = (result: any) => {
    if (result.success) {
      table.deleteRow(individualParticipantIds);
    }
  };
  mutationRequest({ methods, callback: postMutation });
}
