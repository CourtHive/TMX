import { removeAllChildNodes } from 'services/dom/transformers';
import { tournamentEngine } from 'tods-competition-factory';
import { context } from 'services/context';

export function tournamentHeader() {
  const tournamentInfo = tournamentEngine.getTournamentInfo().tournamentInfo;
  const offline = tournamentInfo?.timeItemValues?.TMX?.offline;
  if (offline) {
    const dnav = document.getElementById('dnav');
    dnav.style.backgroundColor = 'lightyellow';
  }

  const tmxButton = document.getElementById('provider');
  if (tmxButton) tmxButton.onclick = () => context.router.navigate('/tournaments');
  const tournamentElement = document.getElementById('pageTitle');
  if (tournamentElement && tournamentInfo?.tournamentName) {
    removeAllChildNodes(tournamentElement);
    tournamentElement.innerHTML = `<div class='tmx-title'>${tournamentInfo?.tournamentName}</div>`;
  } else {
    context.router.navigate('/tournaments');
  }
}
