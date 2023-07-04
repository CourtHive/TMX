import { isFunction } from 'functions/typeOf';

export const teamsFormatter = (teamClick) => (cell) => {
  const def = cell.getColumn().getDefinition();
  const content = document.createElement('div');
  content.className = 'tags';

  const teams = cell.getValue();
  const teamSorter = (a, b) => a?.participantName?.localeCompare(b?.participantName);
  teams.sort(teamSorter).forEach((team) => {
    const pill = createPill({ def, team, teamClick });
    content.appendChild(pill);
  });

  return content;
};

function createPill({ matchUpId, team, teamClick }) {
  const pill = document.createElement('span');
  const { participantId, participantName } = team;
  if (isFunction(teamClick)) {
    pill.onclick = () => teamClick({ participantId, matchUpId });
  }
  pill.className = 'tag event-pill';
  pill.innerHTML = participantName;
  return pill;
}
