import { positionActionConstants, tournamentEngine } from 'tods-competition-factory';
import { selectParticipant } from 'components/modals/selectParticipant';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { mapEntry } from 'pages/tournament/tabs/eventsTab/mapEntry';

const { ASSIGN_PARTICIPANT } = positionActionConstants;

import { ADD_EVENT_ENTRIES } from 'constants/mutationConstants';
import { QUALIFYING, RIGHT } from 'constants/tmxConstants';

export const addEntries = (event, group) => (table) => {
  const onClick = () => {
    const { entries = [], eventId, eventType } = event;
    const enteredParticipantIds = (entries || []).map(({ participantId }) => participantId);
    const participantType =
      (event.eventType === 'TEAM' && 'TEAM') || (event.eventType === 'DOUBLES' && 'PAIR') || 'INDIVIDUAL';
    const participantsAvailable = tournamentEngine
      .getParticipants({ inContext: true, participantFilters: { participantTypes: [participantType] }, withISO2: true })
      .participants.filter((participant) => !enteredParticipantIds.includes(participant.participantId));

    const onSelection = ({ selected }) => {
      if (!selected?.length) return;

      const participantIds = selected.map(({ participantId }) => participantId);
      const entryStage = group === QUALIFYING ? 'QUALIFYING' : 'MAIN';
      const entryStatus = 'DIRECT_ACCEPTANCE';

      const methods = [
        {
          params: { eventId, participantIds, entryStatus, entryStage },
          method: ADD_EVENT_ENTRIES,
        },
      ];

      const postMutation = (result) => {
        if (result.success) {
          const { participants, derivedDrawInfo } = tournamentEngine.getParticipants({
            participantFilters: { participantIds },
            withIndividualParticipants: true,
            withScaleValues: true,
            withDraws: true,
          });

          const newEntries = participantIds.map((participantId) =>
            mapEntry({
              entry: { participantId, entryStage, entryStatus },
              derivedDrawInfo,
              participants,
              eventType,
              eventId,
            }),
          );

          table.addRow(newEntries);
        }
      };
      mutationRequest({ methods, callback: postMutation });
    };

    const action = {
      type: ASSIGN_PARTICIPANT,
      participantsAvailable,
    };

    selectParticipant({
      title: 'Select participants to add',
      activeOnEnter: true,
      selectionLimit: 99,
      onSelection,
      action,
    });
  };

  return {
    label: 'Add entries',
    class: 'addEntries',
    location: RIGHT,
    onClick,
  };
};
