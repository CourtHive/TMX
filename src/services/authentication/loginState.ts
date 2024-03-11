import { getProviders, getUsers, removeUser } from 'services/apis/servicesApi';
import { validateToken } from 'services/authentication/validateToken';
import { getToken, removeToken, setToken } from './tokenManagement';
import { disconnectSocket } from 'services/messaging/socketIo';
import { tournamentEngine } from 'tods-competition-factory';
import { inviteModal } from 'components/modals/inviteUser';
import { loginModal } from 'components/modals/loginModal';
import { selectItem } from 'components/modals/selectItem';
import { tmxToast } from 'services/notifications/tmxToast';
import { tipster } from 'components/popovers/tipster';
import { copyClick } from 'services/dom/copyClick';
import { checkDevState } from './checkDevState';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { INVITE, SUPER_ADMIN, TMX_TOURNAMENTS } from 'constants/tmxConstants';

function styleLogin(valid) {
  const el = document.getElementById('login');
  const impersonating = context?.provider;
  const admin = valid?.roles?.includes(SUPER_ADMIN);
  el.style.color = (impersonating && 'red') || (admin && 'green') || 'blue';
}

export function getLoginState() {
  const token = getToken();
  const valid = validateToken(token);
  if (valid) styleLogin(valid);
  return valid;
}

export function logOut() {
  removeToken();
  checkDevState();
  disconnectSocket();
  context.provider = undefined; // clear provider
  context.router.navigate(`/${TMX_TOURNAMENTS}/logout`);
  const el = document.getElementById('login');
  el.style.color = '';
}

export function logIn({ data, callback }) {
  const valid: any = validateToken(data.token);
  if (valid) {
    setToken(data.token);
    tmxToast({ intent: 'is-success', message: 'Log in successful' });
    disconnectSocket();
    tournamentEngine.reset();
    styleLogin(valid);
    if (isFunction(callback)) callback();
    context.router.navigate(`/${TMX_TOURNAMENTS}/${valid.provider?.organisationAbbreviation}`);
  }
}

export function impersonate() {
  getProviders().then(({ data }) => {
    const options = data?.providers?.map(({ value }) => {
      return {
        onClick: () => {
          context.provider = value;
          context.router.navigate(`/${TMX_TOURNAMENTS}/${value.organisationAbbreviation}`);
        },
        participantName: value.organisationName,
      };
    });

    if (options) selectItem({ title: 'Select Provider', options, selectionLimit: 1 });
  });
}

export function removeUserDialog() {
  getUsers().then(({ data }) => {
    console.log({ data });
    const options = data?.users?.map(({ value }) => {
      return {
        participantName: `${value.firstName} ${value.lastName} (${value.email})`,
        onClick: () => removeUser(value).then(() => tmxToast({ message: 'User removed' })),
      };
    });

    if (options) selectItem({ title: 'Select User', options, selectionLimit: 1 });
  });
}

export function cancelImpersonation() {
  context.provider = undefined;
  context.router.navigate(`/${TMX_TOURNAMENTS}/superadmin`);
}

export function initLoginToggle(id) {
  const el = document.getElementById(id);
  const handleError = (error) => console.log('Invite:', { error });

  if (el) {
    const processInviteResult = (inviteResult) => {
      const inviteCode = inviteResult?.data.inviteCode;
      if (inviteCode) {
        const inviteURL = `${window.location.origin}/#/${INVITE}/${inviteCode}`;
        copyClick(inviteURL);
        console.log({ inviteCode, inviteURL });
      } else {
        handleError(inviteResult);
      }
    };

    el.addEventListener('click', () => {
      const loggedIn: any = getLoginState();
      const admin = loggedIn?.roles?.includes(SUPER_ADMIN);
      const impersonating = context?.provider;

      const items = [
        {
          onClick: () => tmxToast({ message: 'TBD: Registration Modal' }),
          text: 'Register',
          hide: loggedIn,
        },
        {
          onClick: () => loginModal(),
          hide: loggedIn,
          text: 'Log in',
        },
        {
          style: 'text-decoration: line-through;',
          hide: !admin || !impersonating,
          onClick: cancelImpersonation,
          text: 'Impersonate',
        },
        {
          hide: !admin || impersonating,
          onClick: impersonate,
          text: 'Impersonate',
        },
        {
          onClick: removeUserDialog,
          text: 'Remove user',
          hide: !admin,
        },
        {
          onClick: () =>
            getProviders().then(({ data }) => inviteModal(processInviteResult, data?.providers), handleError),
          hide: !admin && !impersonating,
          text: 'Invite User',
        },
        {
          text: 'Log out',
          hide: !loggedIn,
          onClick: logOut,
        },
        {
          divider: true,
        },
        {
          heading: 'Settings',
          onClick: () => tmxToast({ message: 'TBD: Settings' }),
        },
      ];

      tipster({ target: el, title: 'Authorization', items });
    });
  }
}
