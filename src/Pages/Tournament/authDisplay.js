import { getLoginState } from 'services/authentication/loginState';
import { imageClass } from 'assets/imageClass';

import { SUPER_ADMIN } from 'constants/tmxConstants';

const style = ` style='margin-left: .5em; width: 1.5em;'`;
export const authKeys = `<img class='authorizeActions' src='${imageClass.authKeys(true).props.src}' ${style}>`;
export const noAuthKeys = `<img class='authorizeActions' src='${imageClass.authKeys().props.src}' ${style}>`;
export const keyIcon = `<img class='authorizeActions' src='${imageClass.keysIcon().props.src}' ${style}>`;

export function authDisplay() {
  const state = getLoginState();
  const orgAuth = true;

  if (state?.roles?.includes(SUPER_ADMIN)) {
    const element = document.getElementById('authKey');
    if (element) element.innerHTML = (orgAuth && authKeys) || (!orgAuth && noAuthKeys) || keyIcon;
  }
}
