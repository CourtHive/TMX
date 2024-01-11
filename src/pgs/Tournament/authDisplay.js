import { getLoginState } from 'services/authentication/loginState';
import keysGreen from 'assets/icons/keys_green.png';
import keysBlue from 'assets/icons/keys_blue.png';
import keysBlack from 'assets/icons/keys.png';

import { SUPER_ADMIN } from 'constants/tmxConstants';

const style = ` style='margin-left: .5em; width: 1.5em;'`;
export const authKeys = `<img class='authorizeActions' src='${keysGreen}' ${style}>`;
export const noAuthKeys = `<img class='authorizeActions' src='${keysBlue}' ${style}>`;
export const keyIcon = `<img class='authorizeActions' src='${keysBlack}' ${style}>`;

export function authDisplay() {
  const state = getLoginState();
  const orgAuth = true;

  if (state?.roles?.includes(SUPER_ADMIN)) {
    const element = document.getElementById('authKey');
    if (element) element.innerHTML = (orgAuth && authKeys) || (!orgAuth && noAuthKeys) || keyIcon;
  }
}
