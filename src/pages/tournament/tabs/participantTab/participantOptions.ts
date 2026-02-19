import { tournamentEngine, participantConstants, participantRoles } from 'tods-competition-factory';
import { context } from 'services/context';
import { t } from 'i18n';

import { PARTICIPANTS } from 'constants/tmxConstants';

const { INDIVIDUAL, TEAM, GROUP } = participantConstants;
const { OFFICIAL } = participantRoles;

export const participantOptions = (view: string): any[] =>
  [
    { label: t('pages.participants.individuals'), value: INDIVIDUAL, isActive: view === INDIVIDUAL, close: true },
    { label: t('pages.participants.officials'), value: OFFICIAL, isActive: view === OFFICIAL, close: true },
    { label: t('pages.participants.groups'), value: GROUP, isActive: view === GROUP, close: true },
    { label: t('pages.participants.teams'), value: TEAM, isActive: view === TEAM, close: true }
  ].map((option) => ({
    ...option,
    onClick: () => {
      if (option.value !== view) {
        const tournamentId = tournamentEngine.getTournament().tournamentRecord.tournamentId;
        const route = `/tournament/${tournamentId}/${PARTICIPANTS}/${option.value}`;
        context.router.navigate(route);
      }
    }
  }));
