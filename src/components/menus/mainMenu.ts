/**
 * Main application menu.
 * Provides server connection controls and authentication options.
 */
import { getLoginState, logOut } from 'services/authentication/loginState';
import { renderMenu } from 'courthive-components';
import { loginModal } from 'components/modals/loginModal';

import { connectSocket, connected, disconnectSocket } from 'services/messaging/socketIo';

export const mainMenu = (elem: HTMLElement, close: () => void): void => {
  const loggedIn = getLoginState();

  const socketConnected = connected();

  const menu = [
    {
      text: 'Server connection',
      items: [
        { hide: socketConnected, text: 'Connect', onClick: connectSocket },
        { hide: !socketConnected, text: 'Disconnect', onClick: disconnectSocket },
        { hide: loggedIn, text: 'Log in', onClick: loginModal },
        { hide: !loggedIn, text: 'Log out', onClick: logOut },
      ],
    },
  ];

  renderMenu(elem, menu, close);
};
