import { editIndividualParticipant } from './editIndividualParticipant';
import { tournamentEngine } from 'tods-competition-factory';

export function editPlayer({ participantId, callback }) {
  const participant = tournamentEngine.getParticipants({
    participantFilters: { participantIds: [participantId] },
    inContext: false,
  }).participants?.[0];

  if (participant) return editIndividualParticipant({ participant, callback });
}
