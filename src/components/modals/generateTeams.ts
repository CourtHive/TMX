/**
 * Generate full mock teams with individual members.
 * Optionally uses a tieFormat to determine team size.
 */
import { tournamentEngine, fixtures } from 'tods-competition-factory';
import { getGenerateTeamsModal } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { ADD_PARTICIPANTS } from 'constants/mutationConstants';
import { loadUserTieFormats } from 'pages/templates/tieFormatBridge';
import { t } from 'i18n';

const { tieFormats: builtinTieFormats } = fixtures;

export async function generateTeams({ callback }: { callback?: () => void }): Promise<void> {
  const tournamentInfo = tournamentEngine.getTournamentInfo()?.tournamentInfo || {};
  const consideredDate = tournamentInfo.endDate || tournamentInfo.startDate;

  // Build tieFormat options from builtins + user-saved
  const userTieFormats = await loadUserTieFormats();

  const tieFormatOptions = [
    ...Object.entries(builtinTieFormats).map(([key, tf]) => ({
      label: (tf as any).tieFormatName || key,
      value: key,
      tieFormat: tf,
    })),
    ...userTieFormats.map((item) => ({
      label: item.name,
      value: item.id,
      tieFormat: item.tieFormat,
    })),
  ];

  getGenerateTeamsModal({
    consideredDate,
    title: t('modals.generateTeams.title'),
    tieFormats: tieFormatOptions,
    labels: {
      gender: t('modals.generateTeams.gender'),
      teamsCount: t('modals.generateTeams.teamsCount'),
      tieFormatTemplate: t('modals.generateTeams.tieFormatTemplate'),
      manualTeamSize: t('modals.generateTeams.manualTeamSize'),
      playersPerTeam: t('modals.generateTeams.playersPerTeam'),
      countries: t('modals.generateTeams.countries'),
      cancel: t('modals.generateTeams.cancel'),
      generate: t('modals.generateTeams.generate'),
      genderAny: t('genders.any'),
      genderFemale: t('genders.female'),
      genderMale: t('genders.male'),
    },
    callback: (participants) => {
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
