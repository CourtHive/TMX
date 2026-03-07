/**
 * Generate mock participants modal with ratings and role selection.
 * Creates mock players/officials with configurable gender/count/role.
 *
 * Uses the getMockParticipantsModal from courthive-components and adds
 * TMX-specific mutation logic to add participants to the tournament.
 */
import { tournamentEngine, participantRoles } from 'tods-competition-factory';
import { getMockParticipantsModal } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { ADD_PARTICIPANTS } from 'constants/mutationConstants';
import { t } from 'i18n';

const { COMPETITOR, OFFICIAL, COACH, MEDICAL, SECURITY, MEDIA } = participantRoles;

const ROLE_OPTIONS = [
  { label: 'Competitor', value: COMPETITOR },
  { label: 'Official', value: OFFICIAL },
  { label: 'Coach', value: COACH },
  { label: 'Medical', value: MEDICAL },
  { label: 'Security', value: SECURITY },
  { label: 'Media', value: MEDIA },
];

export function mockParticipants({ callback }: { callback?: () => void }): void {
  // Get tournament end date for birthdate generation
  const tournamentInfo = tournamentEngine.getTournamentInfo()?.tournamentInfo || {};
  const consideredDate = tournamentInfo.endDate || tournamentInfo.startDate;

  // Open the modal from courthive-components
  getMockParticipantsModal({
    consideredDate,
    title: t('modals.generateParticipants.title'),
    roleOptions: ROLE_OPTIONS,
    labels: {
      role: t('modals.generateParticipants.role'),
      gender: t('modals.generateParticipants.gender'),
      count: t('modals.generateParticipants.count'),
      minAge: t('modals.generateParticipants.minAge'),
      maxAge: t('modals.generateParticipants.maxAge'),
      ratings: t('modals.generateParticipants.ratings'),
      countries: t('modals.generateParticipants.countries'),
      cancel: t('modals.generateParticipants.cancel'),
      generate: t('modals.generateParticipants.generate'),
      genderAny: t('genders.any'),
      genderFemale: t('genders.female'),
      genderMale: t('genders.male'),
    },
    callback: (participants) => {
      // TMX-specific: Add participants to tournament via mutation
      const methods = [
        {
          method: ADD_PARTICIPANTS,
          params: { participants },
        },
      ];

      mutationRequest({ methods, callback });
    },
  });
}
