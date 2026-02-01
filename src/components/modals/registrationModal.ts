import { systemRegister } from 'services/authentication/authApi';
import { validators, renderForm } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { openModal } from './baseModal/baseModal';
import { context } from 'services/context';

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
          error: 'First name must be at least 2 characters long',
          iconLeft: 'fa-regular fa-user',
          validator: validators.nameValidator(2),
          placeholder: 'First name',
          autocomplete: 'off',
          label: 'First Name',
          field: 'givenName',
        },
        {
          error: 'Last name must be at least 2 characters long',
          validator: validators.nameValidator(2),
          placeholder: 'Last name',
          autocomplete: 'off',
          label: 'Last name',
          field: 'lastName',
        },
        {
          error: 'Must contain upper/lower, number, and special character',
          placeholder: 'minimum 8 characters',
          iconLeft: 'fa-solid fa-lock',
          validator: validators.passwordValidator,
          autocomplete: 'off',
          label: 'Password',
          field: 'password',
          type: 'password',
        },
        {
          placeholder: 'minimum 8 characters',
          error: 'Passwords do not match',
          iconLeft: 'fa-solid fa-lock',
          label: 'Re-enter Password',
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
      tmxToast({ message: 'Success', intent: 'is-success ' });
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
    title: 'Register',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      {
        onClick: submitRegistration,
        intent: 'is-primary',
        id: 'registerButton',
        label: 'Register',
        disabled: true,
        close: true,
      },
    ],
    onClose: () => context.router.navigate('/'),
  });
}
