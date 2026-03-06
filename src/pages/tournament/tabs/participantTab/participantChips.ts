import { tournamentEngine, participantConstants, participantRoles } from 'tods-competition-factory';
import { context } from 'services/context';
import { t } from 'i18n';

import { PARTICIPANTS, LEFT } from 'constants/tmxConstants';

const { INDIVIDUAL, TEAM, GROUP } = participantConstants;
const { OFFICIAL } = participantRoles;

const chipDefs = [
  { value: INDIVIDUAL, icon: 'fa-solid fa-user', labelKey: 'pages.participants.individuals' },
  { value: OFFICIAL, icon: 'fa-solid fa-user-tie', labelKey: 'pages.participants.officials' },
  { value: TEAM, icon: 'fa-solid fa-people-group', labelKey: 'pages.participants.teams' },
  { value: GROUP, icon: 'fa-solid fa-users', labelKey: 'pages.participants.groups' },
];

export function participantChips(view: string): any[] {
  const tournamentId = tournamentEngine.getTournament().tournamentRecord?.tournamentId;

  return chipDefs.map(({ value, icon, labelKey }) => ({
    label: `<i class="${icon}"></i>`,
    toolTip: { content: t(labelKey), placement: 'bottom' },
    intent: view === value ? 'is-info' : 'is-light',
    class: 'participant-chip',
    location: LEFT,
    onClick: () => {
      if (value !== view) {
        const route = `/tournament/${tournamentId}/${PARTICIPANTS}/${value}`;
        context.router?.navigate(route);
      }
    },
  }));
}
