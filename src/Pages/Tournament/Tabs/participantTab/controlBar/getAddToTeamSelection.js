import { mutationRequest } from 'services/mutation/mutationRequest';
import { editTeamParticipant } from '../editTeamParticipant';

import { ADD_INDIVIDUAL_PARTICIPANT_IDS } from 'constants/mutationConstants';

export function getAddToTeamSelection({ teamParticipants, table, replaceTableData }) {
  const addToTeam = ({ team }) => {
    const selected = table.getSelectedData();
    const individualParticipantIds = selected.map(({ participantId }) => participantId);
    table.deselectRow();

    const methods = [
      {
        method: ADD_INDIVIDUAL_PARTICIPANT_IDS,
        params: {
          groupingParticipantId: team.participantId,
          individualParticipantIds
        }
      }
    ];
    const postMutation = (result) => {
      if (result.success) replaceTableData();
    };
    mutationRequest({ methods, callback: postMutation });
  };

  const createNewTeam = () => {
    const selected = table.getSelectedData();
    const individualParticipantIds = selected.map(({ participantId }) => participantId);
    table.deselectRow();
    editTeamParticipant({ title: 'New team', individualParticipantIds, refresh: replaceTableData });
  };

  return {
    options: teamParticipants.map((team) => ({
      onClick: () => addToTeam({ team }),
      label: team.participantName,
      participant: team,
      close: true
    })),
    actions: [
      {
        label: 'Create new team',
        onClick: () => createNewTeam(),
        close: true
      }
    ]
  };
}
