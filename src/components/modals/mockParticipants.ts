/**
 * Generate mock participants modal with ratings and role selection.
 * Creates mock players/officials with configurable gender/count/role.
 *
 * Uses the getMockParticipantsModal from courthive-components and adds
 * TMX-specific mutation logic to add participants to the tournament.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { getMockParticipantsModal } from 'courthive-components';
import { ADD_PARTICIPANTS } from 'constants/mutationConstants';
import { participantRoles } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { t } from 'i18n';

const { COMPETITOR, OFFICIAL, COACH, MEDICAL, SECURITY, MEDIA } = participantRoles;

const roleOptions = () => [
  { label: t('printModals.competitor'), value: COMPETITOR },
  { label: t('modals.inviteUser.official'), value: OFFICIAL },
  { label: t('participantRoles.COACH'), value: COACH },
  { label: t('signin.medical'), value: MEDICAL },
  { label: t('participantRoles.SECURITY'), value: SECURITY },
  { label: t('participantRoles.MEDIA'), value: MEDIA },
];

export function mockParticipants({ callback }: { callback?: () => void }): void {
  // Get tournament end date for birthDate generation
  const tournamentInfo = tournamentEngine.q.tournamentInfo() || {};
  const consideredDate = tournamentInfo.endDate || tournamentInfo.startDate;

  // Open the modal from courthive-components
  getMockParticipantsModal({
    consideredDate,
    title: t('modals.generateParticipants.title'),
    roleOptions: roleOptions(),
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
