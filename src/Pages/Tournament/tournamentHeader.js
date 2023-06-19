import { getLoginState } from 'services/authentication/loginState';
// import { displayAuthOptions } from 'components/menus/authOptions';
import { tournamentEngine } from 'tods-competition-factory';
import { mainMenu } from 'components/menus/mainMenu';
import { authDisplay /*, keyIcon*/ } from './authDisplay';
import { context } from 'services/context';

import { LEFT, RIGHT } from 'constants/tmxConstants';
import { dropDownButton } from 'components/buttons/dropDownButton';

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
        context: 'tournament',
        content: mainMenu,
        width: '200px',
        side: RIGHT
      });
    };
  }

  const tournamentElement = document.getElementById('tournamentName');
  if (tournamentElement) {
    const label = `<div class='tmx-title'>${tournamentInfo?.tournamentName}</div>`;
    dropDownButton({
      target: tournamentElement,
      field: 'tournamentName',
      onClick: () => console.log('boo'),
      button: {
        align: LEFT,
        options: [],
        label
      }
    });
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
