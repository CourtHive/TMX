/**
 * Login modal with email and password validation.
 * Authenticates user credentials and updates login state on success.
 */
import { logIn, logOut } from 'services/authentication/loginState';
import { firstLoginPasswordModal } from './firstLoginPassword';
import { renderForm, validators } from 'courthive-components';
import { systemLogin } from 'services/authentication/authApi';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

export function loginModal(callback?: () => void): void {
  let inputs: any;

  const enableSubmit = ({ inputs }: any) => {
    const value = inputs['email'].value;
    const isValid = validators.emailValidator(value);
    const inviteButton = document.getElementById('loginButton');
    if (inviteButton) (inviteButton as HTMLButtonElement).disabled = !isValid;
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

  openModal({
    title: t('modals.login.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
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
