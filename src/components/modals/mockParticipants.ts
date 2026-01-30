/**
 * Generate mock participants modal with ratings.
 * Creates mock players with WTN/UTR ratings and configurable gender/count.
 * 
 * Uses the getMockParticipantsModal from courthive-components and adds
 * TMX-specific mutation logic to add participants to the tournament.
 */
import { tournamentEngine } from 'tods-competition-factory';
import { getMockParticipantsModal } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { ADD_PARTICIPANTS } from 'constants/mutationConstants';

export function mockParticipants({ callback }: { callback?: () => void }): void {
  // Get tournament end date for birthdate generation
  const tournamentInfo = tournamentEngine.getTournamentInfo()?.tournamentInfo || {};
  const consideredDate = tournamentInfo.endDate || tournamentInfo.startDate;

  // Open the modal from courthive-components
  getMockParticipantsModal({
    consideredDate,
    callback: (participants) => {
      // TMX-specific: Add participants to tournament via mutation
      const methods = [
        {
          method: ADD_PARTICIPANTS,
          params: { participants }
        }
      ];

      mutationRequest({ methods, callback });
    }
  });
}
