import { tournamentEngine, participantConstants, participantRoles } from 'tods-competition-factory';
import { context } from 'services/context';

import { PARTICIPANTS } from 'constants/tmxConstants';

const { INDIVIDUAL, TEAM, GROUP } = participantConstants;
const { OFFICIAL } = participantRoles;

export const participantOptions = (view) =>
  [
    { label: 'Individuals', value: INDIVIDUAL, isActive: view === INDIVIDUAL, close: true },
    { label: 'Officials', value: OFFICIAL, isActive: view === OFFICIAL, close: true },
    { label: 'Groups', value: GROUP, isActive: view === GROUP, close: true },
    { label: 'Teams', value: TEAM, isActive: view === TEAM, close: true }
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
