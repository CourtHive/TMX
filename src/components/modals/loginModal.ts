/**
 * Login modal with email and password validation.
 * Authenticates user credentials and updates login state on success.
 */
import { systemLogin, requestMagicLink } from 'services/authentication/authApi';
import { logIn, logOut } from 'services/authentication/loginState';
import { firstLoginPasswordModal } from './firstLoginPassword';
import { renderForm, validators } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

export function loginModal(callback?: () => void): void {
  let inputs: any;
  let modalHandle: any;

  const enableSubmit = ({ inputs }: any) => {
    const value = inputs['email'].value;
    const isValid = validators.emailValidator(value);
    // Both actions need a valid email; only password-login needs the password
    // field, which the submit handler reads directly.
    modalHandle?.setButtonState('loginButton', { disabled: !isValid });
    modalHandle?.setButtonState('magicLinkButton', { disabled: !isValid });
  };

  const relationships = [
    {
      onInput: enableSubmit,
      control: 'email',
    },
  ];

  const content = (elem: HTMLElement) =>
    (inputs = renderForm(
      elem,
      [
        {
          iconLeft: 'fa-regular fa-envelope',
          placeholder: t('modals.login.emailPlaceholder'),
          validator: validators.emailValidator,
          autocomplete: 'email',
          label: t('modals.login.emailLabel'),
          field: 'email',
          type: 'email',
        },
        {
          placeholder: t('modals.login.passwordPlaceholder'),
          autocomplete: 'current-password',
          iconLeft: 'fa-solid fa-lock',
          label: t('modals.login.passwordLabel'),
          field: 'password',
          type: 'password',
        },
      ],
      relationships,
    ));

  const submitCredentials = () => {
    const email = inputs.email.value;
    const password = inputs.password.value;
    const response = (res: any) => {
      if (!res) logOut();
      if (res?.status !== 200) return;
      // First-login branch: server signals an admin-assigned password that
      // must be changed before a full session is issued. Admin-created users
      // (mustChangePassword=true) receive { mustChangePassword, limitedToken }
      // instead of { token } — route them to set their own password.
      if (res.data?.mustChangePassword && res.data?.limitedToken) {
        firstLoginPasswordModal({ limitedToken: res.data.limitedToken, callback });
        return;
      }
      logIn({ data: res.data, callback });
    };
    systemLogin(email, password).then(response, (err: any) => console.log({ err }));
  };

  // Passwordless option: request a one-time login link by email. The server is
  // enumeration-defensive, so we always show the same neutral confirmation
  // regardless of whether the address maps to an eligible account.
  const submitMagicLink = () => {
    const email = inputs.email.value;
    requestMagicLink(email).catch(() => undefined);
    tmxToast({ intent: 'is-info', message: t('toasts.magicLinkSent') });
  };

  modalHandle = openModal({
    title: t('modals.login.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      {
        onClick: submitMagicLink,
        intent: 'is-link',
        id: 'magicLinkButton',
        disabled: true,
        label: t('modals.login.magicLinkButton'),
        close: true,
      },
      {
        onClick: submitCredentials,
        intent: 'is-primary',
        id: 'loginButton',
        disabled: true,
        label: t('modals.login.loginButton'),
        close: true,
      },
    ],
  });
}
