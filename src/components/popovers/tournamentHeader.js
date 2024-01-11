import { getLoginState } from 'services/authentication/loginState';
// import { displayAuthOptions } from 'components/menus/authOptions';
import { tournamentEngine } from 'tods-competition-factory';
import { mainMenu } from 'components/menus/mainMenu';
import { authDisplay /*, keyIcon*/ } from '../../pages/tournament/authDisplay';
import { context } from 'services/context';

import { RIGHT } from 'constants/tmxConstants';
import { removeAllChildNodes } from 'services/dom/transformers';

export function tournamentHeader() {
  const { tournamentInfo } = tournamentEngine.getTournamentInfo();
  const state = getLoginState();

  /*
  const authorizeActions = (e) => {
    displayAuthOptions({ tournamentId: tournamentInfo.tournamentId, target: e.target });
  };
  */

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

  const tmxButton = document.getElementById('tmx');
  if (tmxButton) tmxButton.onclick = () => context.router.navigate('/tournaments');
  const tournamentElement = document.getElementById('tournamentName');
  if (tournamentElement) {
    removeAllChildNodes(tournamentElement);
    tournamentElement.innerHTML = `<div class='tmx-title'>${tournamentInfo?.tournamentName}</div>`;
  }

  /*
  const authElement = document.getElementById('authorizeActions');
  if (authElement) {
    authElement.onclick = authorizeActions;
    authElement.innerHTML = keyIcon;
  }
  */

  authDisplay();
}
