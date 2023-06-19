import { exportTournamentRecord } from 'components/modals/exportTournamentRecord';
import { getLoginState, logOut } from 'services/authentication/loginState';
import { renderMenu } from 'components/renderers/renderMenu';
import { selectIdiom } from 'components/modals/selectIdiom';
import { loginModal } from 'components/modals/loginModal';
import { tmxNotes } from 'components/menus/tmxNotes';
import { displayQRdialogue } from 'services/qrFx';
import { displayKeyActions } from './keyActions';
import { save } from 'services/storage/save';
import { context } from 'services/context';
import { lang } from 'services/translator';
import { env } from 'settings/env';

import { TMX_TOURNAMENTS, HOME } from 'constants/tmxConstants';

// TODO: REMOVE!!
import { registrationModal } from 'components/modals/registrationModal';
import { connectSocket, connected, disconnectSocket } from 'services/messaging/socketIo';
import { requestTournamentRecord } from 'services/messaging/requestTournamentRecord';

function displayVersion() {
  context.modal.open({
    title: lang.tr('version'),
    content: tmxNotes.version()
  });
}

function displaySupport() {
  context.modal.open({
    title: lang.tr('support'),
    content: tmxNotes.support()
  });
}

// TODO: get tournamentId from tournamentEngine and update URL for new server
function tournamentLink() {
  let url = `${location.origin}/t/${context.tournamentId}`;
  window.open(url, '_blank');
}

// TODO: get tournamentId from tournamentEngine and update URL for new server
function qrCode() {
  const url = `${origin}/t/${context.tournamentId}`;
  displayQRdialogue(url);
}

export const mainMenu = (elem, close, menuContext) => {
  const mobile = !env.device.isMobile && !env.device.isIpad && !env.device.isTablet;
  const noExport = !mobile && context.state.authorized;
  const loggedIn = getLoginState();
  const published = true;

  const qrCodeOrg = () => {
    const url = `${origin}/Live/${loggedIn.profile.provider}`;
    displayQRdialogue(url, `${env.org.abbr}_QR`);
  };
  const orgLink = () => {
    let url = `${location.origin}/Live/${loggedIn.profile.provider}`;
    window.open(url, '_blank');
  };

  const socketConnected = connected();

  const menu = [
    {
      text: 'Main Menu',
      items: [
        { text: 'Keys', onClick: displayKeyActions },
        { text: 'Settings', onClick: () => console.log('settings') }
      ]
    },
    {
      hide: [TMX_TOURNAMENTS, HOME].includes(menuContext),
      text: 'Tournament',
      items: [
        { disabled: !published, text: lang.tr('phrases.weblink'), onClick: tournamentLink },
        { disabled: !published, text: lang.tr('phrases.qrcode'), onClick: qrCode },
        { text: 'Download', onClick: requestTournamentRecord },
        { hide: !context.state.authorized, text: 'Upload', onClick: save.cloud },
        { disabled: noExport, text: 'Export', onClick: exportTournamentRecord }
      ]
    },
    {
      text: 'Server connection',
      items: [
        { hide: socketConnected, text: 'Connect', onClick: connectSocket },
        { hide: !socketConnected, text: 'Disconnect', onClick: disconnectSocket },
        { hide: loggedIn, text: 'Log in', onClick: loginModal },
        { hide: !loggedIn, text: 'Log out', onClick: logOut },
        { hide: loggedIn, text: 'Register', onClick: registrationModal }
      ]
    },
    {
      hide: !loggedIn?.profile?.provider,
      text: 'Organization',
      items: [
        { text: lang.tr('phrases.weblink'), onClick: orgLink },
        { text: lang.tr('phrases.qrcode'), onClick: qrCodeOrg }
      ]
    },
    {
      text: 'Information',
      items: [
        { text: lang.tr('version'), onClick: displayVersion },
        { hide: context.tournamentId, text: lang.tr('lang'), onClick: selectIdiom },
        { text: lang.tr('support'), onClick: displaySupport }
      ]
    }
  ];

  renderMenu(elem, menu, close);
};
