/**
 * First-login password change modal.
 *
 * When an admin creates a user, the server flags the row
 * `must_change_password = TRUE`. On the user's next sign-in, the server
 * verifies the assigned password and returns a short-lived
 * `{ mustChangePassword: true, limitedToken }` instead of a full session
 * JWT. The limited token is verified by /auth/complete-first-login, which
 * accepts a new password, clears the flag, and returns the full JWT.
 *
 * This modal collects the new password + confirmation, POSTs them, and on
 * success hands the returned full JWT off to `logIn()`.
 */
import { completeFirstLogin } from 'services/authentication/authApi';
import { logIn } from 'services/authentication/loginState';
import { tmxToast } from 'services/notifications/tmxToast';
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

const MIN_PASSWORD_LENGTH = 8;

export function firstLoginPasswordModal({
  limitedToken,
  callback,
}: {
  limitedToken: string;
  callback?: () => void;
}): void {
  let inputs: any;

  const enableSubmit = () => {
    const newPassword = inputs?.newPassword?.value ?? '';
    const confirm = inputs?.confirmPassword?.value ?? '';
    const button = document.getElementById('firstLoginSubmit') as HTMLButtonElement | null;
    if (button) {
      button.disabled = newPassword.length < MIN_PASSWORD_LENGTH || newPassword !== confirm;
    }
  };

  const relationships = [
    { onInput: enableSubmit, control: 'newPassword' },
    { onInput: enableSubmit, control: 'confirmPassword' },
  ];

  const content = (elem: HTMLElement) =>
    (inputs = renderForm(
      elem,
      [
        {
          text: t('modals.firstLogin.intro'),
          header: true,
        },
        {
          iconLeft: 'fa-solid fa-lock',
          placeholder: t('modals.firstLogin.newPasswordPlaceholder'),
          autocomplete: 'new-password',
          validator: (v: string) => (v?.length ?? 0) >= MIN_PASSWORD_LENGTH,
          label: t('modals.firstLogin.newPasswordLabel'),
          field: 'newPassword',
          type: 'password',
          id: 'firstLoginNewPassword',
        },
        {
          iconLeft: 'fa-solid fa-lock',
          placeholder: t('modals.firstLogin.confirmPasswordPlaceholder'),
          autocomplete: 'new-password',
          validator: (v: string) => (v?.length ?? 0) > 0,
          label: t('modals.firstLogin.confirmPasswordLabel'),
          field: 'confirmPassword',
          type: 'password',
          id: 'firstLoginConfirmPassword',
        },
      ],
      relationships,
    ));

  const submit = () => {
    const newPassword = inputs?.newPassword?.value ?? '';
    completeFirstLogin(limitedToken, newPassword).then(
      (res: any) => {
        if (res?.status === 200 && res?.data?.token) {
          logIn({ data: res.data, callback });
        } else {
          tmxToast({
            message: res?.data?.error || t('modals.firstLogin.failed'),
            intent: 'is-danger',
          });
        }
      },
      (err: any) => {
        const status = err?.response?.status;
        const message =
          err?.response?.data?.message ||
          (status === 401 ? t('modals.firstLogin.tokenExpired') : t('modals.firstLogin.failed'));
        tmxToast({ message, intent: 'is-danger' });
      },
    );
  };

  openModal({
    title: t('modals.firstLogin.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      {
        onClick: submit,
        intent: 'is-primary',
        id: 'firstLoginSubmit',
        disabled: true,
        label: t('modals.firstLogin.setPassword'),
        close: true,
      },
    ],
  });
}
