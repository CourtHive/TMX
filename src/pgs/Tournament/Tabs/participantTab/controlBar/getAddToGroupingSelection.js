import { editGroupingParticipant } from '../editGroupingParticipant';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { participantConstants } from 'tods-competition-factory';

import { ADD_INDIVIDUAL_PARTICIPANT_IDS } from 'constants/mutationConstants';
const { TEAM } = participantConstants;

export function getAddToGroupingSelection({ participants, table, replaceTableData, participantType = TEAM }) {
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

  const createNewGrouping = () => {
    const title = participantType === TEAM ? 'New team' : 'New Group';
    const selected = table.getSelectedData();
    const individualParticipantIds = selected.map(({ participantId }) => participantId);
    table.deselectRow();
    editGroupingParticipant({
      refresh: replaceTableData,
      individualParticipantIds,
      participantType,
      title
    });
  };

  const label = participantType === TEAM ? 'Create new team' : 'Create new group';

  return {
    options: participants.map((team) => ({
      onClick: () => addToTeam({ team }),
      label: team.participantName,
      participant: team,
      close: true
    })),
    actions: [
      {
        onClick: () => createNewGrouping(),
        close: true,
        label
      }
    ]
  };
}
