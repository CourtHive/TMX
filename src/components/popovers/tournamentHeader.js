import { getLoginState } from 'services/authentication/loginState';
import { removeAllChildNodes } from 'services/dom/transformers';
import { tournamentEngine } from 'tods-competition-factory';
import { mainMenu } from 'components/menus/mainMenu';
import { context } from 'services/context';

import { RIGHT } from 'constants/tmxConstants';

export function tournamentHeader() {
  const { tournamentInfo } = tournamentEngine.getTournamentInfo();
  const state = getLoginState();

  const menuButton = document.getElementById('mainMenu');
  if (menuButton) {
    menuButton.onclick = (e) => {
      e.stopPropagation();

      context.drawer.open({
        title: state?.provider?.providerName || 'TMX',
        content: mainMenu,
        width: '200px',
        side: RIGHT,
      });
    };
  }

  const tmxButton = document.getElementById('provider');
  if (tmxButton) tmxButton.onclick = () => context.router.navigate('/tournaments');
  const tournamentElement = document.getElementById('pageTitle');
  if (tournamentElement) {
    removeAllChildNodes(tournamentElement);
    tournamentElement.innerHTML = `<div class='tmx-title'>${tournamentInfo?.tournamentName}</div>`;
  }
}
