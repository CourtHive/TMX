import { participantConstants, participantRoles } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { context } from 'services/context';
import { t } from 'i18n';

import { PARTICIPANTS, CENTER, STAFF } from 'constants/tmxConstants';

const { INDIVIDUAL, TEAM, GROUP } = participantConstants;
const { OFFICIAL } = participantRoles;

const chipDefs = [
  { value: INDIVIDUAL, icon: 'fa-solid fa-user', labelKey: 'pages.participants.individuals' },
  { value: TEAM, icon: 'fa-solid fa-people-group', labelKey: 'pages.participants.teams' },
  { value: OFFICIAL, icon: 'fa-solid fa-user-tie', labelKey: 'pages.participants.officials' },
  // STAFF rolls up every non-COMPETITOR, non-OFFICIAL role (COACH, MEDICAL,
  // CAPTAIN, ADMINISTRATION, HOSPITALITY, …) into a single roster view.
  // Imported coaches and physios land here.
  { value: STAFF, icon: 'fa-solid fa-user-nurse', labelKey: 'pages.participants.staff' },
  { value: GROUP, icon: 'fa-solid fa-users', labelKey: 'pages.participants.groups' },
];

export function participantChips(view: string): any[] {
  const tournamentId = tournamentEngine.q.tournament()?.tournamentId;

  return chipDefs.map(({ value, icon, labelKey }) => ({
    label: `<i class="${icon}"></i>`,
    toolTip: { content: t(labelKey), placement: 'bottom' },
    intent: view === value ? 'is-info' : 'is-light',
    class: 'participant-chip',
    location: CENTER,
    onClick: () => {
      if (value !== view) {
        const route = `/tournament/${tournamentId}/${PARTICIPANTS}/${value}`;
        context.router?.navigate(route);
      }
    },
  }));
}
