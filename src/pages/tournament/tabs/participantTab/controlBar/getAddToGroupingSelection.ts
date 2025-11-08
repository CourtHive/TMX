/**
 * Get add to team/group selection options.
 * Provides menu to add selected participants to existing teams/groups or create new ones.
 */
import { editGroupingParticipant } from '../editGroupingParticipant';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { participantConstants } from 'tods-competition-factory';

import { ADD_INDIVIDUAL_PARTICIPANT_IDS } from 'constants/mutationConstants';
const { TEAM } = participantConstants;

type GetAddToGroupingSelectionParams = {
  participants: any[];
  table: any;
  replaceTableData: () => void;
  participantType?: string;
};

export function getAddToGroupingSelection({ participants, table, replaceTableData, participantType = TEAM }: GetAddToGroupingSelectionParams): any {
  const addToTeam = ({ team }: { team: any }) => {
    const selected = table.getSelectedData();
    const individualParticipantIds = selected.map(({ participantId }: any) => participantId);
    table.deselectRow();

    const methods = [
      {
        method: ADD_INDIVIDUAL_PARTICIPANT_IDS,
        params: {
          groupingParticipantId: team.participantId,
          individualParticipantIds,
        },
      },
    ];
    const postMutation = (result: any) => {
      if (result.success) replaceTableData();
    };
    mutationRequest({ methods, callback: postMutation });
  };

  const createNewGrouping = () => {
    const title = participantType === TEAM ? 'New team' : 'New Group';
    const selected = table.getSelectedData();
    const individualParticipantIds = selected.map(({ participantId }: any) => participantId);
    (editGroupingParticipant as any)({
      refresh: replaceTableData,
      individualParticipantIds,
      participantType,
      participant: {},
      table,
      title,
    });
  };

  const label = participantType === TEAM ? 'Create new team' : 'Create new group';

  return {
    options: participants.map((team) => ({
      onClick: () => addToTeam({ team }),
      label: team.participantName,
      participant: team,
      close: true,
    })),
    actions: [
      {
        onClick: () => createNewGrouping(),
        close: true,
        label,
      },
    ],
  };
}
