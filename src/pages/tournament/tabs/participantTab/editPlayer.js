import { tournamentEngine } from 'tods-competition-factory';
import { editIndividualParticipant } from './editIndividualParticipant';

export function editPlayer({ participantId }) {
  const participant = tournamentEngine.getParticipants({
    participantFilters: { participantIds: [participantId] },
    inContext: false
  }).participants?.[0];

  if (participant) return editIndividualParticipant({ participant });
}
