import { systemRegister } from 'services/authentication/authApi';
import { validators, renderForm } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { openModal } from './baseModal/baseModal';
import { context } from 'services/context';
import { t } from 'i18n';

export function registrationModal(params) {
  let inputs;

  const passwordMatch = (value) => value === inputs.password.value;

  const enableSubmit = ({ inputs }) => {
    const registerButton = document.getElementById('registerButton');
    if (registerButton) {
      const isValid =
        passwordMatch(inputs['passwordConfirm'].value) &&
        validators.passwordValidator(inputs['password'].value) &&
        validators.nameValidator(2)(inputs['givenName'].value) &&
        validators.nameValidator(2)(inputs['lastName'].value);

      if (isValid) {
        registerButton.removeAttribute('disabled');
      } else {
        registerButton.setAttribute('disabled', '');
      }
    }
  };

  const relationships = [
    {
      onInput: enableSubmit,
      control: 'passwordConfirm',
    },
  ];

  const content = (elem) =>
    (inputs = renderForm(
      elem,
      [
        {
          error: t('modals.registration.firstNameError'),
          iconLeft: 'fa-regular fa-user',
          validator: validators.nameValidator(2),
          placeholder: t('modals.registration.firstNamePlaceholder'),
          autocomplete: 'off',
          label: t('modals.registration.firstNameLabel'),
          field: 'givenName',
        },
        {
          error: t('modals.registration.lastNameError'),
          validator: validators.nameValidator(2),
          placeholder: t('modals.registration.lastNamePlaceholder'),
          autocomplete: 'off',
          label: t('modals.registration.lastNameLabel'),
          field: 'lastName',
        },
        {
          error: t('modals.registration.passwordError'),
          placeholder: t('modals.registration.passwordPlaceholder'),
          iconLeft: 'fa-solid fa-lock',
          validator: validators.passwordValidator,
          autocomplete: 'off',
          label: t('modals.registration.passwordLabel'),
          field: 'password',
          type: 'password',
        },
        {
          placeholder: t('modals.registration.passwordPlaceholder'),
          error: t('modals.registration.confirmPasswordError'),
          iconLeft: 'fa-solid fa-lock',
          label: t('modals.registration.confirmPasswordLabel'),
          validator: passwordMatch,
          field: 'passwordConfirm',
          autocomplete: 'off',
          type: 'password',
        },
      ],
      relationships,
    ));

  const submitRegistration = () => {
    const lastName = inputs.lastName.value;
    const firstName = inputs.givenName.value;
    const password = inputs.password.value;
    const code = params?.data?.inviteKey;

    const success = () => {
      tmxToast({ message: t('common.success'), intent: 'is-success ' });
    };
    const handleError = (err) => {
      tmxToast({ message: err?.message, intent: 'is-danger' });
    };
    const response = (res) => {
      res?.status === 200 && res?.data?.success ? success() : handleError(res?.data);
    };
    systemRegister(firstName, lastName, password, code).then(response, handleError);
  };

  openModal({
    title: t('modals.registration.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      {
        onClick: submitRegistration,
        intent: 'is-primary',
        id: 'registerButton',
        label: t('modals.registration.register'),
        disabled: true,
        close: true,
      },
    ],
    onClose: () => context.router?.navigate('/'),
  });
}
