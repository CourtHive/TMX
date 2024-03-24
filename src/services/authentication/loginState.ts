import { getProviders, getUsers, removeUser } from 'services/apis/servicesApi';
import { selectProviderModal } from 'components/modals/selectProviderModal';
import { tournamentActions } from 'components/modals/tournamentActions';
import { validateToken } from 'services/authentication/validateToken';
import { getToken, removeToken, setToken } from './tokenManagement';
import { editProviderModal } from 'components/modals/editProvider';
import { settingsModal } from 'components/modals/settingsModal';
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

import { INVITE, SUPER_ADMIN, ADMIN, TMX_TOURNAMENTS } from 'constants/tmxConstants';

export function styleLogin(valid) {
  const el = document.getElementById('login');
  const impersonating = context?.provider;
  const admin = valid?.roles?.includes(SUPER_ADMIN);
  if (!valid) {
    el.style.color = '';
  } else {
    el.style.color = (impersonating && 'red') || (admin && 'green') || 'blue';
  }
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
  styleLogin(false);
}

export function logIn({ data, callback }) {
  const valid: any = validateToken(data.token);
  const tournamentInState = tournamentEngine.getTournament().tournamentRecord?.tournamentId;
  if (valid) {
    setToken(data.token);
    tmxToast({ intent: 'is-success', message: 'Log in successful' });
    disconnectSocket();
    if (!tournamentInState) tournamentEngine.reset();
    styleLogin(valid);
    if (isFunction(callback)) {
      callback();
    } else if (!tournamentInState) {
      context.router.navigate(`/${TMX_TOURNAMENTS}/${valid.provider?.organisationAbbreviation}`);
    }
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
        const inviteURL = `${window.location.origin}${window.location.pathname}/#/${INVITE}/${inviteCode}`;
        copyClick(inviteURL);
        console.log({ inviteCode, inviteURL });
      } else {
        handleError(inviteResult);
      }
    };

    const providerSelected = (provider) => setTimeout(() => editProviderModal({ provider }), 200);

    el.addEventListener('click', () => {
      const loggedIn: any = getLoginState();
      const superAdmin = loggedIn?.roles?.includes(SUPER_ADMIN);
      const admin = loggedIn?.roles?.includes(ADMIN);
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
          hide: !superAdmin || !impersonating,
          onClick: cancelImpersonation,
          text: 'Impersonate',
        },
        {
          hide: !superAdmin || impersonating,
          onClick: impersonate,
          text: 'Impersonate',
        },
        {
          onClick: editProviderModal,
          text: 'Create provider',
          hide: !superAdmin,
        },
        {
          onClick: () => selectProviderModal({ callback: providerSelected }),
          text: 'Edit provider',
          hide: !superAdmin,
        },
        {
          onClick: removeUserDialog,
          text: 'Remove user',
          hide: !superAdmin,
        },
        {
          onClick: () =>
            getProviders().then(({ data }) => inviteModal(processInviteResult, data?.providers), handleError),
          hide: !superAdmin && !impersonating,
          text: 'Invite User',
        },
        {
          text: 'Log out',
          hide: !loggedIn,
          onClick: logOut,
        },
        { hide: !admin, divider: true },
        {
          onClick: tournamentActions,
          heading: 'Actions',
          hide: !admin,
        },
        {
          divider: true,
        },
        {
          onClick: settingsModal,
          heading: 'Settings',
        },
      ];

      tipster({ target: el, title: 'Authorization', items });
    });
  }
}
