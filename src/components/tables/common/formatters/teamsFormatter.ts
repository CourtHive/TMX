import { isFunction } from 'functions/typeOf';

export const teamsFormatter = (teamClick?: (params: any) => void) => (cell: any): HTMLDivElement => {
  const def = cell.getColumn().getDefinition();
  const content = document.createElement('div');
  content.className = 'tags';

  const teams = cell.getValue();
  const teamSorter = (a: any, b: any) => a?.participantName?.localeCompare(b?.participantName);
  teams.sort(teamSorter).forEach((team: any) => {
    const pill = createPill({ matchUpId: def.matchUpId, team, teamClick });
    content.appendChild(pill);
  });

  return content;
};

function createPill({ matchUpId, team, teamClick }: { matchUpId?: string; team: any; teamClick?: (params: any) => void }): HTMLSpanElement {
  const pill = document.createElement('span');
  const { participantId, participantName } = team;
  if (isFunction(teamClick) && teamClick) {
    pill.onclick = () => teamClick({ participantId, matchUpId });
  }
  pill.className = 'tag event-pill';
  pill.innerHTML = participantName;
  return pill;
}
